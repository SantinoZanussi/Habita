/**
 * Servicio del modulo Obras.
 *
 * Dos responsabilidades:
 *
 *  1. RECALCULAR EL CAMINO CRITICO cada vez que entra un avance. El cliente
 *     nunca calcula: manda el dato crudo (partida, porcentaje, foto, hora) y el
 *     backend recalcula duraciones, holguras y fecha estimada de fin.
 *
 *  2. DEDUPLICAR AVANCES POR `idempotencyKey`. En una obra rara vez hay wifi.
 *     La app guarda los avances en una cola local y los sincroniza al recuperar
 *     senal; ahi es normal que mande dos veces la misma carga. La clave la
 *     genera el cliente y el backend la usa como ID DE DOCUMENTO: el segundo
 *     escrito apunta al mismo documento y la transaccion lo descarta.
 *
 *     Usar la clave como id del documento (en vez de consultarla con un where)
 *     es lo que hace la deduplicacion atomica: no hay ventana entre "consulto
 *     si existe" y "lo creo".
 */

import { db, rutas, FieldValue, aObjeto, aLista } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';
import { log } from '../infra/log.js';
import { calcularCaminoCritico, compararAvanceContraGasto } from '../dominio/cpm.js';
import { validarCercania } from '../externos/mapas.js';
import { enviarATokens, avisos } from '../externos/notificaciones.js';

const aFecha = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const DIA = 86_400_000;

/**
 * Recalcula el cronograma de una obra y guarda el resultado.
 * Es la funcion que se llama despues de cada avance y cada vez que se edita
 * una partida.
 */
export async function recalcularCronograma({ complejoId, obraId }) {
  const [obraSnap, partidasSnap] = await Promise.all([
    rutas.obra(complejoId, obraId).get(),
    rutas.partidas(complejoId, obraId).get(),
  ]);

  const obra = aObjeto(obraSnap);
  if (!obra) throw errores.noEncontrado('La obra');

  const partidas = aLista(partidasSnap);
  const fechaInicio = aFecha(obra.fechaInicio) ?? new Date();
  const ahora = new Date();

  const entrada = partidas.map((p) => {
    const inicioReal = aFecha(p.fechaInicioReal);
    const transcurridos = inicioReal
      ? Math.max(0, Math.floor((ahora - inicioReal) / DIA))
      : 0;
    return {
      id: p.id,
      nombre: p.nombre,
      duracionEstimada: p.duracionEstimada,
      predecesoras: p.predecesoras ?? [],
      avancePorcentaje: p.avancePorcentaje ?? 0,
      diasTranscurridos: transcurridos,
      presupuestoCentavos: p.presupuestoCentavos ?? 0,
    };
  });

  const cronograma = calcularCaminoCritico({
    partidas: entrada,
    fechaInicio,
    calendario: obra.calendario ?? 'habil',
    diasLaborables: obra.diasLaborables ?? [1, 2, 3, 4, 5, 6],
  });

  const comparacion = compararAvanceContraGasto({
    avanceFisicoPorcentaje: cronograma.avanceFisicoPorcentaje,
    presupuestoAprobadoCentavos: obra.presupuestoAprobado ?? 0,
    gastoEjecutadoCentavos: obra.gastoEjecutado ?? 0,
  });

  // Se persiste el resultado del calculo en cada partida para que el panel y la
  // app puedan leerlo en tiempo real con un `onSnapshot`, sin llamar al backend.
  const lote = db.batch();
  for (const p of cronograma.partidas) {
    lote.update(rutas.partidas(complejoId, obraId).doc(p.id), {
      duracionProyectada: p.duracionProyectada,
      origenDuracion: p.origenDuracion,
      holgura: p.holgura,
      esCritica: p.esCritica,
      fechaInicioTemprano: p.fechaInicioTemprano,
      fechaFinTemprano: p.fechaFinTemprano,
      fechaFinTardio: p.fechaFinTardio,
      actualizadoEn: FieldValue.serverTimestamp(),
    });
  }

  const fechaFinAnterior = aFecha(obra.fechaFinEstimada);

  lote.update(rutas.obra(complejoId, obraId), {
    duracionPlanificada: cronograma.duracionPlanificada,
    duracionProyectada: cronograma.duracionProyectada,
    corrimientoDias: cronograma.corrimientoDias,
    fechaFinPlanificada: cronograma.fechaFinPlanificada,
    fechaFinEstimada: cronograma.fechaFinEstimada,
    caminoCritico: cronograma.caminoCritico,
    avanceFisicoPorcentaje: cronograma.avanceFisicoPorcentaje,
    comparacionGasto: comparacion,
    actualizadoEn: FieldValue.serverTimestamp(),
  });

  await lote.commit();

  return {
    ...cronograma,
    comparacionGasto: comparacion,
    fechaFinAnterior,
    seCorrio: fechaFinAnterior
      ? cronograma.fechaFinEstimada.getTime() !== fechaFinAnterior.getTime()
      : false,
  };
}

/**
 * Registra un avance de obra.
 *
 * @param {object} entrada
 * @param {string} entrada.idempotencyKey  La genera el cliente. Es el id del documento.
 * @param {string} [entrada.timestampCliente] Cuando se cargo en el celular (puede ser viejo).
 */
export async function registrarAvance({
  complejoId, obraId, partidaId, porcentaje, autorUid,
  fotoUrl = null, coordenadas = null, observacion = null,
  idempotencyKey, timestampCliente = null,
}) {
  if (!idempotencyKey) {
    throw errores.datosInvalidos(
      { idempotencyKey: 'es obligatorio' },
      'Cada avance necesita una clave de idempotencia generada en el dispositivo'
    );
  }

  const [obraSnap, partidaSnap] = await Promise.all([
    rutas.obra(complejoId, obraId).get(),
    rutas.partidas(complejoId, obraId).doc(partidaId).get(),
  ]);

  const obra = aObjeto(obraSnap);
  const partida = aObjeto(partidaSnap);
  if (!obra) throw errores.noEncontrado('La obra');
  if (!partida) throw errores.noEncontrado('La partida');
  if (obra.estado === 'finalizada') {
    throw errores.conflicto('La obra ya esta finalizada: no se pueden cargar mas avances.');
  }

  // Un avance no puede retroceder. Si hay que corregir hacia abajo, se carga
  // un avance CORRECTIVO explicito, que queda registrado como tal. La coleccion
  // es append-only: nada se edita, todo se agrega.
  const avanceAnterior = Number(partida.avancePorcentaje ?? 0);
  const esCorrectivo = porcentaje < avanceAnterior;

  const cercania = coordenadas && obra.coordenadas
    ? validarCercania({ punto: coordenadas, referencia: obra.coordenadas, radioMetros: 800 })
    : { verificado: false, motivo: 'sin_coordenadas' };

  const refAvance = rutas.avances(complejoId, obraId).doc(idempotencyKey);

  const resultado = await db.runTransaction(async (tx) => {
    const yaExiste = await tx.get(refAvance);
    if (yaExiste.exists) {
      return { duplicado: true, avanceId: idempotencyKey };
    }

    tx.set(refAvance, {
      partidaId,
      partidaNombre: partida.nombre,
      porcentaje,
      porcentajeAnterior: avanceAnterior,
      esCorrectivo,
      observacion,
      fotoUrl,
      coordenadas,
      cercania,
      autorUid,
      timestampCliente: timestampCliente ? new Date(timestampCliente) : null,
      timestampServidor: FieldValue.serverTimestamp(),
      idempotencyKey,
      // Un avance cargado sin senal llega tarde: se deja constancia de cuanto.
      cargadoOffline: Boolean(timestampCliente && Date.now() - new Date(timestampCliente).getTime() > 5 * 60_000),
    });

    const cambios = {
      avancePorcentaje: porcentaje,
      ultimoAvanceEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    };
    // La primera carga de avance marca el inicio real de la partida: es el dato
    // con el que despues se reestima su duracion.
    if (avanceAnterior === 0 && porcentaje > 0 && !partida.fechaInicioReal) {
      cambios.fechaInicioReal = FieldValue.serverTimestamp();
    }
    if (porcentaje >= 100) cambios.fechaFinReal = FieldValue.serverTimestamp();

    tx.update(rutas.partidas(complejoId, obraId).doc(partidaId), cambios);

    return { duplicado: false, avanceId: idempotencyKey };
  });

  if (resultado.duplicado) {
    log.info('Avance duplicado descartado por idempotencyKey', { obraId, partidaId, idempotencyKey });
    return { duplicado: true, avanceId: idempotencyKey, cronograma: null };
  }

  // Recien despues de escribir el avance se recalcula el cronograma.
  const cronograma = await recalcularCronograma({ complejoId, obraId });

  if (cronograma.seCorrio && cronograma.corrimientoDias > 0) {
    avisarCorrimiento({ complejoId, obra, cronograma }).catch(() => {});
  }

  log.info('Avance registrado', {
    complejoId, obraId, partidaId, porcentaje,
    corrimiento: cronograma.corrimientoDias, esCorrectivo,
  });

  return { duplicado: false, avanceId: idempotencyKey, esCorrectivo, cronograma };
}

/**
 * Avisa del corrimiento a quien corresponda: al propietario si la obra es
 * privada, a todo el complejo si es comun (todos la estan pagando).
 */
async function avisarCorrimiento({ complejoId, obra, cronograma }) {
  let consulta = rutas.usuarios().where('complejoId', '==', complejoId);
  if (obra.tipo === 'privada' && obra.unidadId) {
    consulta = consulta.where('unidadId', '==', obra.unidadId);
  }

  const usuarios = await consulta.get();
  const tokens = usuarios.docs.map((d) => d.data().tokenFcm).filter(Boolean);
  if (tokens.length === 0) return;

  const aviso = avisos.obraAtrasada({
    obra: obra.nombre,
    dias: cronograma.corrimientoDias,
    nuevaFecha: cronograma.fechaFinEstimada.toLocaleDateString('es-AR'),
  });

  await enviarATokens({ tokens, ...aviso, datos: { tipo: 'obra', obraId: obra.id } });
}

/**
 * Sincroniza una cola de avances acumulados sin conexion.
 * Devuelve el resultado de cada uno para que la app sepa cuales borrar de su
 * cola local y cuales reintentar.
 */
export async function sincronizarCola({ complejoId, obraId, avances, autorUid }) {
  const resultados = [];

  // En serie a proposito: varios avances de la misma obra tocan las mismas
  // partidas, y procesarlos en paralelo dispararia reintentos de transaccion.
  for (const avance of avances) {
    try {
      const resultado = await registrarAvance({ ...avance, complejoId, obraId, autorUid });
      resultados.push({
        idempotencyKey: avance.idempotencyKey,
        estado: resultado.duplicado ? 'duplicado' : 'registrado',
      });
    } catch (error) {
      resultados.push({
        idempotencyKey: avance.idempotencyKey,
        estado: 'error',
        codigo: error.codigo ?? 'ERROR',
        mensaje: error.message,
        // Un error de datos no se reintenta nunca mas; uno de red, si.
        reintentable: (error.estado ?? 500) >= 500,
      });
    }
  }

  const cronograma = resultados.some((r) => r.estado === 'registrado')
    ? await recalcularCronograma({ complejoId, obraId })
    : null;

  return { resultados, cronograma };
}
