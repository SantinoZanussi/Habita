/**
 * Servicio de reclamos.
 *
 * El residente crea el reclamo desde la app (regla de Firestore lo permite,
 * porque no tiene logica de negocio). El backend lo clasifica con IA y escribe
 * el resultado: la API key no puede vivir en el celular.
 *
 * La clasificacion NUNCA bloquea. Si la IA no responde, el reclamo queda con la
 * clasificacion por palabras clave y confianza baja, y la administracion lo ve
 * marcado. Un caño roto no puede esperar a que un servicio externo vuelva.
 *
 * Todo cambio de estado deja rastro en `historialEstados`, incluida la
 * correccion de la clasificacion del modelo. Poder mostrar cuantas veces se
 * corrigio a la IA es mas honesto que decir que acierta siempre.
 */

import { rutas, FieldValue, aObjeto, aLista, db } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';
import { log } from '../infra/log.js';
import { clasificarReclamo, prioridadDe, AREAS, URGENCIAS } from '../externos/ia.js';
import { enviarATokens, avisos } from '../externos/notificaciones.js';

export const ESTADOS = Object.freeze(['pendiente', 'en_progreso', 'esperando_proveedor', 'resuelto', 'anulado']);

/** Transiciones permitidas. Sin esto, un reclamo puede pasar de resuelto a pendiente. */
const TRANSICIONES = Object.freeze({
  pendiente: ['en_progreso', 'esperando_proveedor', 'anulado'],
  en_progreso: ['esperando_proveedor', 'resuelto', 'anulado'],
  esperando_proveedor: ['en_progreso', 'resuelto', 'anulado'],
  resuelto: ['en_progreso'],      // reapertura: pasa, pero queda registrada
  anulado: [],
});

/**
 * Clasifica un reclamo recien creado y escribe el resultado.
 * Se llama justo despues del alta, desde la ruta.
 */
export async function clasificarYGuardar({ complejoId, reclamoId }) {
  const reclamo = aObjeto(await rutas.reclamo(complejoId, reclamoId).get());
  if (!reclamo) throw errores.noEncontrado('El reclamo');

  const [complejo, unidad] = await Promise.all([
    rutas.complejo(complejoId).get().then(aObjeto),
    reclamo.unidadId ? rutas.unidad(complejoId, reclamo.unidadId).get().then(aObjeto) : null,
  ]);

  const clasificacion = await clasificarReclamo({
    descripcion: reclamo.descripcion,
    fotoUrl: reclamo.fotoUrl,
    tipoComplejo: complejo?.tipo ?? 'edificio',
    ubicacion: unidad?.identificador ?? '',
  });

  await rutas.reclamo(complejoId, reclamoId).update({
    clasificacionIA: {
      area: clasificacion.area,
      urgencia: clasificacion.urgencia,
      confianza: clasificacion.confianza,
      resumen: clasificacion.resumen,
      accionSugerida: clasificacion.accionSugerida,
      requiereIngresoProveedor: clasificacion.requiereIngresoProveedor,
      origen: clasificacion.origen,
      modelo: clasificacion.modelo,
      clasificadoEn: FieldValue.serverTimestamp(),
    },
    // La clasificacion final arranca igual que la de la IA. Si la
    // administracion la corrige, cambia esta y la de la IA queda intacta,
    // que es lo que permite medir el acierto del modelo.
    clasificacionFinal: {
      area: clasificacion.area,
      urgencia: clasificacion.urgencia,
      corregidaPorHumano: false,
    },
    prioridad: prioridadDe(clasificacion),
    resumen: clasificacion.resumen,
    actualizadoEn: FieldValue.serverTimestamp(),
  });

  log.info('Reclamo clasificado', {
    complejoId, reclamoId, area: clasificacion.area,
    urgencia: clasificacion.urgencia, confianza: clasificacion.confianza,
    origen: clasificacion.origen,
  });

  return clasificacion;
}

/**
 * Corrige la clasificacion. Queda registrado que un humano corrigio a la IA:
 * es el dato con el que se mide si el clasificador sirve.
 */
export async function corregirClasificacion({ complejoId, reclamoId, area, urgencia, adminUid }) {
  if (area && !AREAS.includes(area)) {
    throw errores.datosInvalidos({ area: `tiene que ser una de: ${AREAS.join(', ')}` });
  }
  if (urgencia && !URGENCIAS.includes(urgencia)) {
    throw errores.datosInvalidos({ urgencia: `tiene que ser una de: ${URGENCIAS.join(', ')}` });
  }

  const ref = rutas.reclamo(complejoId, reclamoId);
  const reclamo = aObjeto(await ref.get());
  if (!reclamo) throw errores.noEncontrado('El reclamo');

  const anterior = reclamo.clasificacionFinal ?? {};
  const nueva = {
    area: area ?? anterior.area,
    urgencia: urgencia ?? anterior.urgencia,
    corregidaPorHumano: true,
    corregidaPorUid: adminUid,
    corregidaEn: FieldValue.serverTimestamp(),
  };

  await ref.update({
    clasificacionFinal: nueva,
    prioridad: prioridadDe({ urgencia: nueva.urgencia }),
    historialCorrecciones: FieldValue.arrayUnion({
      de: { area: anterior.area, urgencia: anterior.urgencia },
      a: { area: nueva.area, urgencia: nueva.urgencia },
      porUid: adminUid,
      // arrayUnion no admite serverTimestamp: se usa la hora del backend.
      en: new Date().toISOString(),
    }),
    actualizadoEn: FieldValue.serverTimestamp(),
  });

  return nueva;
}

/** Cambia el estado del reclamo validando la transicion y dejando historial. */
export async function cambiarEstado({ complejoId, reclamoId, estado, nota = null, proveedorId = null, actorUid }) {
  if (!ESTADOS.includes(estado)) {
    throw errores.datosInvalidos({ estado: `tiene que ser uno de: ${ESTADOS.join(', ')}` });
  }

  const ref = rutas.reclamo(complejoId, reclamoId);

  const resultado = await db.runTransaction(async (tx) => {
    const reclamo = aObjeto(await tx.get(ref));
    if (!reclamo) throw errores.noEncontrado('El reclamo');

    const actual = reclamo.estado ?? 'pendiente';
    if (actual === estado) return { sinCambios: true, reclamo };

    if (!TRANSICIONES[actual]?.includes(estado)) {
      throw errores.conflicto(
        `Un reclamo ${actual} no puede pasar a ${estado}.`,
        { estadoActual: actual, transicionesPosibles: TRANSICIONES[actual] }
      );
    }

    tx.update(ref, {
      estado,
      ...(proveedorId !== null ? { proveedorAsignadoId: proveedorId } : {}),
      ...(estado === 'resuelto' ? { resueltoEn: FieldValue.serverTimestamp() } : {}),
      historialEstados: FieldValue.arrayUnion({
        de: actual, a: estado, nota, porUid: actorUid, en: new Date().toISOString(),
      }),
      actualizadoEn: FieldValue.serverTimestamp(),
    });

    return { sinCambios: false, reclamo, estadoAnterior: actual };
  });

  if (!resultado.sinCambios) {
    avisarCambioDeEstado({ complejoId, reclamo: resultado.reclamo, estado }).catch(() => {});
  }

  return { estado, estadoAnterior: resultado.estadoAnterior ?? estado, sinCambios: resultado.sinCambios };
}

async function avisarCambioDeEstado({ complejoId, reclamo, estado }) {
  if (!reclamo.autorUid) return;
  const usuario = aObjeto(await rutas.usuario(reclamo.autorUid).get());
  if (!usuario?.tokenFcm) return;

  const legible = { pendiente: 'pendiente', en_progreso: 'en progreso', esperando_proveedor: 'esperando al proveedor', resuelto: 'resuelto', anulado: 'anulado' };
  const aviso = avisos.reclamoActualizado({
    numero: reclamo.numero ?? reclamo.id?.slice(0, 6),
    estado: legible[estado] ?? estado,
  });

  await enviarATokens({
    tokens: [usuario.tokenFcm], ...aviso,
    datos: { tipo: 'reclamo', reclamoId: reclamo.id ?? '' },
  });
}

/**
 * Bandeja priorizada del panel.
 * Ordena por prioridad de urgencia y, dentro de eso, por antiguedad. Es lo que
 * reemplaza a leer cuarenta mensajes de WhatsApp.
 */
export async function bandeja({ complejoId, estado = null, area = null, limite = 100 }) {
  let consulta = rutas.reclamos(complejoId);
  if (estado) consulta = consulta.where('estado', '==', estado);

  const reclamos = aLista(await consulta.limit(limite * 2).get())
    .filter((r) => !area || r.clasificacionFinal?.area === area)
    .sort((a, b) => {
      const prioridad = (b.prioridad ?? 0) - (a.prioridad ?? 0);
      if (prioridad !== 0) return prioridad;
      const fechaA = a.creadoEn?.toMillis?.() ?? 0;
      const fechaB = b.creadoEn?.toMillis?.() ?? 0;
      return fechaA - fechaB;   // el mas viejo primero
    })
    .slice(0, limite);

  return reclamos;
}

/** Metricas de la bandeja para el dashboard. */
export async function metricas({ complejoId }) {
  const todos = aLista(await rutas.reclamos(complejoId).get());

  const porEstado = {};
  const porArea = {};
  let conIa = 0;
  let corregidos = 0;
  let sumaConfianza = 0;
  let tiempoResolucionTotal = 0;
  let resueltos = 0;

  for (const r of todos) {
    porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1;
    const area = r.clasificacionFinal?.area ?? 'sin_clasificar';
    porArea[area] = (porArea[area] ?? 0) + 1;

    if (r.clasificacionIA?.origen === 'ia') {
      conIa += 1;
      sumaConfianza += r.clasificacionIA.confianza ?? 0;
      if (r.clasificacionFinal?.corregidaPorHumano) corregidos += 1;
    }

    if (r.estado === 'resuelto' && r.creadoEn && r.resueltoEn) {
      tiempoResolucionTotal += r.resueltoEn.toMillis() - r.creadoEn.toMillis();
      resueltos += 1;
    }
  }

  return {
    total: todos.length,
    abiertos: todos.filter((r) => !['resuelto', 'anulado'].includes(r.estado)).length,
    porEstado,
    porArea,
    ia: {
      clasificadosConIa: conIa,
      corregidosPorHumano: corregidos,
      // El dato honesto: cuantas veces la administracion tuvo que corregir al
      // modelo. Se muestra en el panel, no se esconde.
      tasaCorreccion: conIa > 0 ? Math.round((corregidos / conIa) * 1000) / 10 : 0,
      confianzaPromedio: conIa > 0 ? Math.round(sumaConfianza / conIa) : 0,
    },
    horasPromedioResolucion: resueltos > 0
      ? Math.round((tiempoResolucionTotal / resueltos / 3_600_000) * 10) / 10
      : null,
  };
}
