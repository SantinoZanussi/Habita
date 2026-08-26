/**
 * NUCLEO 3 - Camino critico de una obra (CPM, Critical Path Method).
 *
 * Una obra es un grafo dirigido aciclico de partidas: "revoque" no puede
 * empezar hasta que termine "mamposteria". El camino critico es la cadena de
 * partidas cuya demora corre la fecha de fin de TODA la obra. Una partida con
 * holgura se puede atrasar sin consecuencias; una critica, no.
 *
 * El momento de la demo:
 *   el responsable carga un atraso en una partida menor, el panel muestra que
 *   la obra entera se corre tres semanas porque esa partida no tenia holgura,
 *   y en la app del residente cambia sola la fecha estimada de finalizacion.
 *
 * Como se calcula:
 *   1. orden topologico (Kahn). Si hay ciclo, la obra esta mal cargada y se
 *      rechaza: sin orden topologico no hay CPM posible.
 *   2. pasada hacia adelante  -> inicio y fin TEMPRANOS de cada partida.
 *   3. pasada hacia atras     -> inicio y fin TARDIOS.
 *   4. holgura = inicio tardio - inicio temprano. Holgura 0 => partida critica.
 *
 * Se corre dos veces: con las duraciones PLANIFICADAS y con las PROYECTADAS a
 * partir del avance real cargado. La diferencia entre las dos fechas de fin es
 * el corrimiento de la obra.
 *
 * Funcion pura. No sabe que existe Firestore.
 */

/** Dias de la semana laborables por defecto en obra: lunes a sabado. */
export const DIAS_LABORABLES_POR_DEFECTO = [1, 2, 3, 4, 5, 6];

/**
 * Suma dias de calendario o dias habiles de obra a una fecha.
 * En obra no se trabaja domingo, asi que contar dias corridos adelanta la
 * fecha de fin una semana cada dos meses. El calendario es configurable.
 */
export function sumarDias(fecha, dias, { calendario = 'habil', diasLaborables = DIAS_LABORABLES_POR_DEFECTO } = {}) {
  const resultado = new Date(fecha.getTime());
  if (calendario === 'corrido' || diasLaborables.length === 7) {
    resultado.setUTCDate(resultado.getUTCDate() + dias);
    return resultado;
  }
  let restantes = Math.round(dias);
  const paso = restantes >= 0 ? 1 : -1;
  restantes = Math.abs(restantes);
  while (restantes > 0) {
    resultado.setUTCDate(resultado.getUTCDate() + paso);
    if (diasLaborables.includes(resultado.getUTCDay())) restantes -= 1;
  }
  return resultado;
}

/**
 * Ordena las partidas de forma que ninguna aparezca antes que sus predecesoras.
 * @throws {Error} si hay un ciclo o una predecesora inexistente.
 */
export function ordenTopologico(partidas) {
  const porId = new Map(partidas.map((p) => [p.id, p]));
  const gradoEntrada = new Map(partidas.map((p) => [p.id, 0]));
  const sucesoras = new Map(partidas.map((p) => [p.id, []]));

  for (const partida of partidas) {
    for (const pred of partida.predecesoras ?? []) {
      if (!porId.has(pred)) {
        const error = new Error(`La partida "${partida.id}" depende de "${pred}", que no existe en la obra`);
        error.codigo = 'PREDECESORA_INEXISTENTE';
        throw error;
      }
      gradoEntrada.set(partida.id, gradoEntrada.get(partida.id) + 1);
      sucesoras.get(pred).push(partida.id);
    }
  }

  // Cola inicial ordenada por id: mismo grafo, mismo resultado, siempre.
  const cola = partidas.filter((p) => gradoEntrada.get(p.id) === 0).map((p) => p.id).sort();
  const orden = [];

  while (cola.length > 0) {
    const id = cola.shift();
    orden.push(id);
    for (const sucesora of sucesoras.get(id)) {
      gradoEntrada.set(sucesora, gradoEntrada.get(sucesora) - 1);
      if (gradoEntrada.get(sucesora) === 0) {
        cola.push(sucesora);
        cola.sort();
      }
    }
  }

  if (orden.length !== partidas.length) {
    const enCiclo = partidas.filter((p) => !orden.includes(p.id)).map((p) => p.id);
    const error = new Error(`Las partidas ${enCiclo.join(', ')} forman una dependencia circular`);
    error.codigo = 'CICLO_EN_PARTIDAS';
    error.partidas = enCiclo;
    throw error;
  }

  return { orden, sucesoras, porId };
}

/**
 * Reestima la duracion de una partida a partir del avance real cargado.
 *
 * Si una partida planificada en 10 dias lleva 8 dias corridos y solo el 40 %
 * de avance, su rendimiento real es 5 %/dia y va a terminar en 20 dias, no en
 * 10. Es el mismo razonamiento que el indice de rendimiento del cronograma en
 * gestion de proyectos, dicho sin la jerga.
 */
export function reestimarDuracion(partida) {
  const plan = Math.max(1, Math.round(partida.duracionEstimada));
  const avance = Number(partida.avancePorcentaje ?? 0);
  const transcurridos = Number(partida.diasTranscurridos ?? 0);

  if (avance >= 100) return { duracion: Math.max(1, transcurridos || plan), origen: 'terminada' };
  if (avance <= 0 || transcurridos <= 0) return { duracion: plan, origen: 'planificada' };

  const proyectada = Math.ceil((transcurridos * 100) / avance);
  // Una partida que va adelantada no acorta la obra por si sola: el resto de
  // la cadena sigue tardando lo mismo. Se toma el maximo para no prometer
  // fechas que despues no se cumplen.
  return {
    duracion: Math.max(plan, proyectada),
    origen: proyectada > plan ? 'reestimada' : 'planificada',
    rendimientoDiario: avance / transcurridos,
  };
}

/** Pasada hacia adelante y hacia atras sobre un conjunto de duraciones. */
function pasadas({ orden, sucesoras, porId }, duracionDe) {
  const inicioTemprano = new Map();
  const finTemprano = new Map();

  for (const id of orden) {
    const partida = porId.get(id);
    const inicio = (partida.predecesoras ?? []).reduce(
      (acc, pred) => Math.max(acc, finTemprano.get(pred) ?? 0), 0
    );
    inicioTemprano.set(id, inicio);
    finTemprano.set(id, inicio + duracionDe(partida));
  }

  const duracionTotal = orden.reduce((acc, id) => Math.max(acc, finTemprano.get(id)), 0);

  const inicioTardio = new Map();
  const finTardio = new Map();

  for (const id of [...orden].reverse()) {
    const partida = porId.get(id);
    const siguientes = sucesoras.get(id);
    const fin = siguientes.length === 0
      ? duracionTotal
      : siguientes.reduce((acc, s) => Math.min(acc, inicioTardio.get(s)), Infinity);
    finTardio.set(id, fin);
    inicioTardio.set(id, fin - duracionDe(partida));
  }

  return { inicioTemprano, finTemprano, inicioTardio, finTardio, duracionTotal };
}

/**
 * Calcula el camino critico de una obra.
 *
 * @param {object} entrada
 * @param {Array<{id:string, nombre:string, duracionEstimada:number, predecesoras?:string[], avancePorcentaje?:number, diasTranscurridos?:number, presupuestoCentavos?:number}>} entrada.partidas
 * @param {Date} entrada.fechaInicio
 * @param {'habil'|'corrido'} [entrada.calendario]
 * @param {number[]} [entrada.diasLaborables]
 */
export function calcularCaminoCritico({
  partidas,
  fechaInicio,
  calendario = 'habil',
  diasLaborables = DIAS_LABORABLES_POR_DEFECTO,
}) {
  if (!Array.isArray(partidas) || partidas.length === 0) {
    return {
      partidas: [], duracionPlanificada: 0, duracionProyectada: 0, corrimientoDias: 0,
      fechaFinPlanificada: fechaInicio, fechaFinEstimada: fechaInicio,
      caminoCritico: [], avanceFisicoPorcentaje: 0, hayCorrimiento: false,
    };
  }

  const ids = partidas.map((p) => p.id);
  if (new Set(ids).size !== ids.length) {
    const error = new Error('Hay partidas con el mismo identificador dentro de la obra');
    error.codigo = 'PARTIDA_DUPLICADA';
    throw error;
  }

  const grafo = ordenTopologico(partidas);

  const reestimaciones = new Map(partidas.map((p) => [p.id, reestimarDuracion(p)]));
  const plan = pasadas(grafo, (p) => Math.max(1, Math.round(p.duracionEstimada)));
  const real = pasadas(grafo, (p) => reestimaciones.get(p.id).duracion);

  const opcionesFecha = { calendario, diasLaborables };

  const resultado = partidas.map((p) => {
    const reest = reestimaciones.get(p.id);
    const holgura = real.inicioTardio.get(p.id) - real.inicioTemprano.get(p.id);
    return {
      id: p.id,
      nombre: p.nombre,
      predecesoras: p.predecesoras ?? [],
      duracionEstimada: Math.max(1, Math.round(p.duracionEstimada)),
      duracionProyectada: reest.duracion,
      origenDuracion: reest.origen,
      avancePorcentaje: Number(p.avancePorcentaje ?? 0),
      inicioTemprano: real.inicioTemprano.get(p.id),
      finTemprano: real.finTemprano.get(p.id),
      inicioTardio: real.inicioTardio.get(p.id),
      finTardio: real.finTardio.get(p.id),
      holgura,
      esCritica: holgura === 0,
      fechaInicioTemprano: sumarDias(fechaInicio, real.inicioTemprano.get(p.id), opcionesFecha),
      fechaFinTemprano: sumarDias(fechaInicio, real.finTemprano.get(p.id), opcionesFecha),
      fechaFinTardio: sumarDias(fechaInicio, real.finTardio.get(p.id), opcionesFecha),
      presupuestoCentavos: p.presupuestoCentavos ?? 0,
    };
  });

  // Avance fisico de la obra: promedio ponderado del avance de cada partida.
  // Se pondera por presupuesto si esta cargado (es la medida honesta) y por
  // duracion si no lo esta.
  const hayPresupuesto = resultado.some((p) => p.presupuestoCentavos > 0);
  const pesoDe = (p) => (hayPresupuesto ? p.presupuestoCentavos : p.duracionEstimada);
  const pesoTotal = resultado.reduce((acc, p) => acc + pesoDe(p), 0) || 1;
  const avanceFisico = resultado.reduce((acc, p) => acc + p.avancePorcentaje * pesoDe(p), 0) / pesoTotal;

  return {
    partidas: resultado,
    duracionPlanificada: plan.duracionTotal,
    duracionProyectada: real.duracionTotal,
    corrimientoDias: real.duracionTotal - plan.duracionTotal,
    hayCorrimiento: real.duracionTotal > plan.duracionTotal,
    fechaInicio,
    fechaFinPlanificada: sumarDias(fechaInicio, plan.duracionTotal, opcionesFecha),
    fechaFinEstimada: sumarDias(fechaInicio, real.duracionTotal, opcionesFecha),
    caminoCritico: resultado.filter((p) => p.esCritica).map((p) => p.id),
    partidasSinHolgura: resultado.filter((p) => p.holgura === 0).length,
    avanceFisicoPorcentaje: Math.round(avanceFisico * 100) / 100,
    calendario,
  };
}

/**
 * Compara el avance FISICO de la obra contra el avance del GASTO.
 *
 * Es la pregunta que se hace todo propietario durante una obra comun: "en que
 * va y en que se gasto mi plata". Si la obra va por el 40 % y ya se gasto el
 * 75 % del presupuesto aprobado, eso tiene que verse solo.
 */
export function compararAvanceContraGasto({ avanceFisicoPorcentaje, presupuestoAprobadoCentavos, gastoEjecutadoCentavos }) {
  const avanceGasto = presupuestoAprobadoCentavos > 0
    ? (gastoEjecutadoCentavos / presupuestoAprobadoCentavos) * 100
    : 0;
  const desvio = avanceGasto - avanceFisicoPorcentaje;
  return {
    avanceFisicoPorcentaje: Math.round(avanceFisicoPorcentaje * 100) / 100,
    avanceGastoPorcentaje: Math.round(avanceGasto * 100) / 100,
    desvioPorcentaje: Math.round(desvio * 100) / 100,
    // Umbral de 10 puntos: por debajo es ruido de cronograma, por encima es
    // una obra que se esta comiendo el presupuesto antes de tiempo.
    enAlerta: desvio > 10,
    // Proyeccion lineal de cuanto va a costar la obra a este ritmo de gasto.
    costoProyectadoCentavos: avanceFisicoPorcentaje > 0
      ? Math.round((gastoEjecutadoCentavos * 100) / avanceFisicoPorcentaje)
      : 0,
  };
}
