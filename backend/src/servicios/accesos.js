/**
 * NUCLEO 2 - Control de acceso concurrente.
 *
 * EL PROBLEMA: dos puestos de guardia escaneando al mismo tiempo no pueden
 * validar la misma autorizacion de visita. Una autorizacion tiene vigencia
 * horaria y cantidad de usos permitidos, y consumir un uso tiene que ser una
 * operacion ATOMICA.
 *
 * COMO SE RESUELVE:
 *   1. Una TRANSACCION de Firestore sobre el documento de la autorizacion.
 *      Firestore usa control de concurrencia optimista: si otro proceso
 *      modifico el documento entre la lectura y la escritura, la transaccion
 *      se reintenta sola. El segundo guardia lee `usosConsumidos: 1` y su
 *      validacion se rechaza por SIN_USOS.
 *   2. El evento de acceso se escribe DENTRO de la misma transaccion. Si la
 *      transaccion se cae, no queda un evento huerfano diciendo que alguien
 *      entro cuando en realidad no entro.
 *   3. `eventosAcceso` es APPEND-ONLY por regla de seguridad: no se puede
 *      editar ni borrar, ni siquiera por el admin. Un sistema que registra
 *      quien entro a un barrio no puede permitir que alguien reescriba la
 *      historia.
 *
 * Los rechazos TAMBIEN se registran. Un intento de ingreso denegado a las tres
 * de la mañana es exactamente el dato que una administracion necesita ver.
 */

import { db, rutas, FieldValue, aObjeto, aLista } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';
import { log } from '../infra/log.js';
import {
  evaluarAutorizacion, verificarCodigoDinamico, normalizarPatente, MOTIVOS_RECHAZO,
} from '../dominio/accesos.js';
import { entorno } from '../config/entorno.js';

export const SENTIDOS = Object.freeze(['ingreso', 'egreso']);
export const METODOS = Object.freeze(['qr_dinamico', 'qr_autorizacion', 'patente', 'nfc', 'manual']);

/**
 * Valida una credencial y, si corresponde, registra el ingreso.
 *
 * @param {object} entrada
 * @param {string} entrada.complejoId
 * @param {string} entrada.guardiaUid
 * @param {string} [entrada.codigo]     Contenido del QR escaneado.
 * @param {string} [entrada.patente]    Alternativa: patente tipeada por el guardia.
 * @param {string} entrada.punto        Punto de acceso ("porton-principal").
 * @param {string} [entrada.sentido]
 * @param {string} [entrada.fotoUrl]    Captura del momento del ingreso.
 */
export async function validarAcceso({
  complejoId, guardiaUid, codigo = null, patente = null,
  punto, sentido = 'ingreso', fotoUrl = null,
}) {
  if (!codigo && !patente) {
    throw errores.datosInvalidos(
      { codigo: 'hace falta un codigo o una patente' },
      'Escanea un QR o ingresa una patente'
    );
  }

  const complejo = aObjeto(await rutas.complejo(complejoId).get());
  if (!complejo) throw errores.noEncontrado('El complejo');

  const contexto = { complejoId, guardiaUid, punto, sentido, fotoUrl, complejo };

  if (codigo && String(codigo).startsWith('HB1.')) {
    return validarQrDinamico({ ...contexto, codigo });
  }
  if (codigo) {
    return validarAutorizacion({ ...contexto, codigoQr: String(codigo).trim() });
  }
  return validarPatente({ ...contexto, patente });
}

// ---------------------------------------------------------------------------
//  QR dinamico del residente
// ---------------------------------------------------------------------------

async function validarQrDinamico({ complejoId, guardiaUid, punto, sentido, fotoUrl, codigo, complejo }) {
  const verificacion = verificarCodigoDinamico({ secreto: entorno.secretoQr, codigo });

  if (!verificacion.valido) {
    return registrarRechazo({
      complejoId, guardiaUid, punto, sentido, fotoUrl,
      metodo: 'qr_dinamico', motivo: verificacion.motivo,
      datos: { complejoDelCodigo: verificacion.complejoId ?? null },
    });
  }

  // Un QR generado en otro complejo no abre este porton, aunque la firma sea
  // valida. Sin este chequeo, un residente de un complejo de la misma cartera
  // podria entrar a cualquier otro.
  if (verificacion.complejoId !== complejoId) {
    return registrarRechazo({
      complejoId, guardiaUid, punto, sentido, fotoUrl,
      metodo: 'qr_dinamico', motivo: 'El codigo pertenece a otro complejo',
    });
  }

  const usuario = aObjeto(await rutas.usuario(verificacion.sujeto).get());
  if (!usuario || usuario.activo === false || usuario.complejoId !== complejoId) {
    return registrarRechazo({
      complejoId, guardiaUid, punto, sentido, fotoUrl,
      metodo: 'qr_dinamico', motivo: MOTIVOS_RECHAZO.UNIDAD_INACTIVA,
    });
  }

  const unidad = usuario.unidadId ? aObjeto(await rutas.unidad(complejoId, usuario.unidadId).get()) : null;

  const evento = await registrarEvento({
    complejoId,
    datos: {
      resultado: 'permitido',
      metodo: 'qr_dinamico',
      punto, sentido, guardiaUid, fotoUrl,
      unidadId: usuario.unidadId ?? null,
      autorizacionId: null,
      nombre: usuario.nombre ?? 'Residente',
      tipoPersona: 'residente',
    },
  });

  return {
    permitido: true,
    tipo: 'residente',
    nombre: usuario.nombre ?? 'Residente',
    unidad: unidad?.identificador ?? null,
    unidadId: usuario.unidadId ?? null,
    usosRestantes: null,
    eventoId: evento.id,
    nomenclatura: complejo.tipoUnidad ?? 'departamento',
  };
}

// ---------------------------------------------------------------------------
//  Autorizacion de visita, proveedor u obra: la parte transaccional
// ---------------------------------------------------------------------------

async function validarAutorizacion({ complejoId, guardiaUid, punto, sentido, fotoUrl, codigoQr, complejo }) {
  // Se busca fuera de la transaccion porque las transacciones de Firestore no
  // permiten consultas con `where` sobre colecciones grandes de forma directa.
  // El id del documento se resuelve aca y la transaccion opera sobre el doc.
  const encontrados = await rutas.autorizaciones(complejoId)
    .where('codigoQr', '==', codigoQr).limit(1).get();

  if (encontrados.empty) {
    return registrarRechazo({
      complejoId, guardiaUid, punto, sentido, fotoUrl,
      metodo: 'qr_autorizacion', motivo: MOTIVOS_RECHAZO.NO_ENCONTRADA,
    });
  }

  const refAutorizacion = encontrados.docs[0].ref;
  const refEvento = rutas.eventosAcceso(complejoId).doc();

  // ---- LA TRANSACCION -----------------------------------------------------
  // Todo lo que sigue ocurre de forma atomica. Si otro guardia esta corriendo
  // esta misma transaccion sobre la misma autorizacion, Firestore aborta una
  // de las dos y la reintenta con el dato ya actualizado.
  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(refAutorizacion);
    const autorizacion = aObjeto(snap);

    const decision = evaluarAutorizacion({
      autorizacion,
      ahora: new Date(),
      punto,
      zonaHoraria: complejo.zonaHoraria,
    });

    const comun = {
      metodo: 'qr_autorizacion',
      punto, sentido, guardiaUid, fotoUrl,
      autorizacionId: refAutorizacion.id,
      unidadId: autorizacion?.unidadId ?? null,
      nombre: autorizacion?.nombre ?? 'Sin nombre',
      documento: autorizacion?.documento ?? null,
      tipoPersona: autorizacion?.tipo ?? 'visita',
      timestampServidor: FieldValue.serverTimestamp(),
      creadoEn: FieldValue.serverTimestamp(),
    };

    if (!decision.permitido) {
      tx.set(refEvento, {
        ...comun,
        resultado: 'rechazado',
        motivoRechazo: decision.motivo,
        detalleRechazo: { ...decision, permitido: undefined, motivo: undefined },
      });
      return { decision, autorizacion, eventoId: refEvento.id };
    }

    // El egreso no consume usos: la persona ya esta adentro.
    const consume = sentido === 'ingreso';
    if (consume) {
      tx.update(refAutorizacion, {
        usosConsumidos: FieldValue.increment(1),
        ultimoUsoEn: FieldValue.serverTimestamp(),
        actualizadoEn: FieldValue.serverTimestamp(),
      });
    }

    tx.set(refEvento, { ...comun, resultado: 'permitido', motivoRechazo: null });

    return { decision, autorizacion, eventoId: refEvento.id, consumio: consume };
  });

  const { decision, autorizacion, eventoId, consumio } = resultado;

  if (!decision.permitido) {
    log.info('Acceso rechazado', { complejoId, punto, motivo: decision.motivo });
    return {
      permitido: false,
      motivo: decision.motivo,
      detalle: decision,
      tipo: autorizacion?.tipo ?? 'visita',
      nombre: autorizacion?.nombre ?? null,
      eventoId,
    };
  }

  const usosPermitidos = Number(autorizacion.usosPermitidos ?? 0);
  const usosConsumidos = Number(autorizacion.usosConsumidos ?? 0) + (consumio ? 1 : 0);
  const unidad = autorizacion.unidadId
    ? aObjeto(await rutas.unidad(complejoId, autorizacion.unidadId).get())
    : null;

  return {
    permitido: true,
    tipo: autorizacion.tipo,
    nombre: autorizacion.nombre,
    documento: autorizacion.documento ?? null,
    patente: autorizacion.patente ?? null,
    unidad: unidad?.identificador ?? null,
    unidadId: autorizacion.unidadId ?? null,
    autorizadoPorUid: autorizacion.autorizadoPorUid ?? null,
    usosPermitidos: usosPermitidos || null,
    usosConsumidos,
    usosRestantes: usosPermitidos > 0 ? usosPermitidos - usosConsumidos : null,
    venceEl: decision.venceEl,
    eventoId,
  };
}

// ---------------------------------------------------------------------------
//  Patente: barrera vehicular
// ---------------------------------------------------------------------------

async function validarPatente({ complejoId, guardiaUid, punto, sentido, fotoUrl, patente, complejo }) {
  const normalizada = normalizarPatente(patente);

  // 1) Patente de un residente cargada en su unidad.
  const unidades = await rutas.unidades(complejoId)
    .where('patentesAutorizadas', 'array-contains', normalizada).limit(1).get();

  if (!unidades.empty) {
    const unidad = aObjeto(unidades.docs[0]);
    if (unidad.estado === 'baja') {
      return registrarRechazo({
        complejoId, guardiaUid, punto, sentido, fotoUrl,
        metodo: 'patente', motivo: MOTIVOS_RECHAZO.UNIDAD_INACTIVA, datos: { patente: normalizada },
      });
    }

    const evento = await registrarEvento({
      complejoId,
      datos: {
        resultado: 'permitido', metodo: 'patente', punto, sentido, guardiaUid, fotoUrl,
        unidadId: unidad.id, autorizacionId: null, patente: normalizada,
        nombre: unidad.identificador, tipoPersona: 'residente',
      },
    });

    return {
      permitido: true, tipo: 'residente', patente: normalizada,
      unidad: unidad.identificador, unidadId: unidad.id,
      nombre: `Vehiculo de ${unidad.identificador}`,
      eventoId: evento.id,
    };
  }

  // 2) Patente declarada en una autorizacion vigente (proveedor, obra, visita).
  const autorizadas = await rutas.autorizaciones(complejoId)
    .where('patenteNormalizada', '==', normalizada)
    .where('estado', '==', 'vigente')
    .limit(1).get();

  if (autorizadas.empty) {
    return registrarRechazo({
      complejoId, guardiaUid, punto, sentido, fotoUrl,
      metodo: 'patente', motivo: 'La patente no esta autorizada en este complejo',
      datos: { patente: normalizada },
    });
  }

  return validarAutorizacion({
    complejoId, guardiaUid, punto, sentido, fotoUrl, complejo,
    codigoQr: aObjeto(autorizadas.docs[0]).codigoQr,
  });
}

// ---------------------------------------------------------------------------
//  Escritura del log append-only
// ---------------------------------------------------------------------------

async function registrarEvento({ complejoId, datos }) {
  const ref = rutas.eventosAcceso(complejoId).doc();
  await ref.set({
    ...datos,
    timestampServidor: FieldValue.serverTimestamp(),
    creadoEn: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

async function registrarRechazo({ complejoId, guardiaUid, punto, sentido, fotoUrl, metodo, motivo, datos = {} }) {
  const evento = await registrarEvento({
    complejoId,
    datos: {
      resultado: 'rechazado', motivoRechazo: motivo, metodo, punto, sentido,
      guardiaUid, fotoUrl, unidadId: null, autorizacionId: null,
      nombre: datos.nombre ?? null, ...datos,
    },
  });
  log.info('Acceso rechazado', { complejoId, punto, metodo, motivo });
  return { permitido: false, motivo, eventoId: evento.id, ...datos };
}

// ---------------------------------------------------------------------------
//  Consultas para el panel
// ---------------------------------------------------------------------------

/** Ultimos eventos del complejo. Alimenta el tablero de accesos en vivo. */
export async function ultimosEventos(complejoId, { limite = 50, punto = null } = {}) {
  let consulta = rutas.eventosAcceso(complejoId).orderBy('timestampServidor', 'desc').limit(limite);
  if (punto) {
    consulta = rutas.eventosAcceso(complejoId)
      .where('punto', '==', punto).orderBy('timestampServidor', 'desc').limit(limite);
  }
  return aLista(await consulta.get());
}

/**
 * Quien esta adentro ahora mismo.
 *
 * Se calcula recorriendo los eventos del dia y quedandose con el ultimo de cada
 * persona: si su ultimo movimiento fue un ingreso, esta adentro. Es exacto y no
 * necesita mantener un contador aparte que se puede desincronizar.
 */
export async function quienEstaAdentro(complejoId) {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  const eventos = await rutas.eventosAcceso(complejoId)
    .where('timestampServidor', '>=', desde)
    .orderBy('timestampServidor', 'asc')
    .get();

  const estado = new Map();
  for (const doc of eventos.docs) {
    const e = doc.data();
    if (e.resultado !== 'permitido') continue;
    const clave = e.autorizacionId ?? `unidad:${e.unidadId}:${e.nombre}`;
    estado.set(clave, e);
  }

  return [...estado.values()]
    .filter((e) => e.sentido === 'ingreso')
    .map((e) => ({
      nombre: e.nombre,
      tipoPersona: e.tipoPersona,
      unidadId: e.unidadId,
      punto: e.punto,
      desde: e.timestampServidor?.toDate?.()?.toISOString() ?? null,
      patente: e.patente ?? null,
    }));
}
