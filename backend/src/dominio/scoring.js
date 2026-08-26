/**
 * Modulo Evaluacion de ingresantes - motor de scoring y curva de esfuerzo.
 *
 * Cuando una unidad cambia de manos, la administracion necesita saber una cosa
 * puntual: si esa persona va a poder sostener la expensa. Un moroso no es un
 * problema entre el y la administracion, es un problema de todos los vecinos,
 * porque el gasto se reparte igual.
 *
 * Dos calculos distintos:
 *
 *   SCORE (0 a 100)  - foto de hoy: relacion ingreso/expensa, garantia,
 *                      composicion del grupo conviviente y antecedentes de
 *                      pago dentro del sistema.
 *
 *   CURVA DE ESFUERZO - la pelicula: la expensa no es fija, sube con la
 *                      inflacion y con las paritarias del personal. Con el
 *                      indice real del BCRA se proyecta que porcentaje del
 *                      ingreso se va a llevar la expensa en el mes 6, 12 y 18,
 *                      y en que mes el candidato entra en zona roja.
 *
 * Los pesos son configuracion, no constantes escondidas en el codigo: cada
 * administradora tiene su criterio y tiene que poder ajustarlo.
 */

export const PESOS_POR_DEFECTO = Object.freeze({
  relacionIngresoExpensa: 45,
  garantia: 25,
  grupoConviviente: 10,
  antecedentes: 20,
});

/** Puntaje de cada tipo de garantia, de la mas solida a la mas debil. */
export const PUNTAJE_GARANTIA = Object.freeze({
  propietario: 100,      // garante con inmueble propio
  seguroDeCaucion: 90,
  reciboDeSueldo: 75,
  garantiaSolidaria: 65,
  deposito: 50,
  sinGarantia: 0,
});

/** Umbral de esfuerzo a partir del cual la expensa se vuelve insostenible. */
export const UMBRAL_ESFUERZO_ROJO = 30;
export const UMBRAL_ESFUERZO_AMARILLO = 22;

/**
 * Puntua la relacion entre el ingreso declarado y la expensa.
 * Por debajo del 10 % de esfuerzo es holgado; arriba del 35 % es inviable.
 * Entre medio interpola lineal, que es honesto y explicable.
 */
function puntuarEsfuerzo(esfuerzoPorcentaje) {
  if (esfuerzoPorcentaje <= 10) return 100;
  if (esfuerzoPorcentaje >= 35) return 0;
  return Math.round(((35 - esfuerzoPorcentaje) / 25) * 100);
}

/**
 * Puntua la composicion del grupo conviviente contra la superficie de la unidad.
 * No es un juicio sobre las personas: es densidad de ocupacion, que en un
 * complejo se traduce en desgaste de amenities y en consumo de servicios.
 */
function puntuarGrupo({ integrantes, superficieM2 }) {
  if (!superficieM2 || superficieM2 <= 0) return 60;
  const m2PorPersona = superficieM2 / Math.max(1, integrantes);
  if (m2PorPersona >= 30) return 100;
  if (m2PorPersona <= 10) return 20;
  return Math.round(20 + ((m2PorPersona - 10) / 20) * 80);
}

/**
 * Puntua los antecedentes de pago dentro del sistema. Solo aplica si la
 * persona ya fue residente en otro complejo de la cartera: es la ventaja
 * concreta de que la administradora tenga todo en un mismo lugar.
 */
function puntuarAntecedentes(historial) {
  if (!historial || historial.periodosEvaluados === 0) {
    return { puntaje: 60, origen: 'sinHistorial' };  // neutro, no penaliza
  }
  const { periodosEvaluados, periodosPagadosATiempo, diasMoraPromedio = 0 } = historial;
  const puntualidad = (periodosPagadosATiempo / periodosEvaluados) * 100;
  const castigoPorMora = Math.min(30, diasMoraPromedio);
  return {
    puntaje: Math.max(0, Math.round(puntualidad - castigoPorMora)),
    origen: 'historialInterno',
    puntualidadPorcentaje: Math.round(puntualidad),
  };
}

/**
 * Calcula el score de un candidato.
 *
 * @param {object} entrada
 * @param {number} entrada.ingresoMensualCentavos
 * @param {number} entrada.expensaMensualCentavos
 * @param {string} entrada.tipoGarantia
 * @param {number} entrada.integrantesGrupo
 * @param {number} [entrada.superficieM2]
 * @param {object} [entrada.historialPago]
 * @param {object} [entrada.pesos]
 */
export function calcularScore({
  ingresoMensualCentavos,
  expensaMensualCentavos,
  tipoGarantia = 'sinGarantia',
  integrantesGrupo = 1,
  superficieM2 = 0,
  historialPago = null,
  pesos = PESOS_POR_DEFECTO,
}) {
  if (!ingresoMensualCentavos || ingresoMensualCentavos <= 0) {
    throw new RangeError('El ingreso declarado tiene que ser mayor a cero');
  }

  const esfuerzo = (expensaMensualCentavos / ingresoMensualCentavos) * 100;
  const antecedentes = puntuarAntecedentes(historialPago);

  const componentes = {
    relacionIngresoExpensa: puntuarEsfuerzo(esfuerzo),
    garantia: PUNTAJE_GARANTIA[tipoGarantia] ?? 0,
    grupoConviviente: puntuarGrupo({ integrantes: integrantesGrupo, superficieM2 }),
    antecedentes: antecedentes.puntaje,
  };

  const pesoTotal = Object.values(pesos).reduce((a, b) => a + b, 0);
  const score = Math.round(
    Object.entries(componentes).reduce((acc, [clave, valor]) => acc + valor * (pesos[clave] ?? 0), 0) / pesoTotal
  );

  return {
    score,
    esfuerzoInicialPorcentaje: Math.round(esfuerzo * 100) / 100,
    componentes,
    pesos,
    origenAntecedentes: antecedentes.origen,
    // La recomendacion es una sugerencia, no una decision automatica: quien
    // aprueba o rechaza es una persona, y el sistema deja constancia de eso.
    recomendacion: score >= 70 ? 'aprobar' : score >= 50 ? 'revisar' : 'rechazar',
  };
}

/**
 * Proyecta la curva de esfuerzo mes a mes.
 *
 * La expensa se indexa con la inflacion real (serie del BCRA) y el ingreso con
 * la recomposicion salarial esperada, que historicamente corre por detras. El
 * cruce de esas dos curvas es el mes en el que el candidato entra en zona roja.
 *
 * @param {object} entrada
 * @param {number} entrada.ingresoMensualCentavos
 * @param {number} entrada.expensaMensualCentavos
 * @param {number[]} entrada.inflacionMensualPorcentaje  Una entrada por mes proyectado.
 * @param {number} [entrada.recomposicionSalarialPorcentaje]  Ajuste mensual del ingreso.
 * @param {number} [entrada.meses]
 */
export function proyectarCurvaDeEsfuerzo({
  ingresoMensualCentavos,
  expensaMensualCentavos,
  inflacionMensualPorcentaje = [],
  recomposicionSalarialPorcentaje = null,
  meses = 18,
}) {
  // Si no se pasa recomposicion, se asume que el ingreso sigue a la inflacion
  // con un rezago del 20 %, que es lo que muestran las series historicas.
  const promedioInflacion = inflacionMensualPorcentaje.length > 0
    ? inflacionMensualPorcentaje.reduce((a, b) => a + b, 0) / inflacionMensualPorcentaje.length
    : 0;

  let expensa = expensaMensualCentavos;
  let ingreso = ingresoMensualCentavos;
  const curva = [];
  let mesZonaRoja = null;
  let mesZonaAmarilla = null;

  for (let mes = 1; mes <= meses; mes += 1) {
    const inflacion = inflacionMensualPorcentaje[mes - 1] ?? promedioInflacion;
    const ajusteIngreso = recomposicionSalarialPorcentaje ?? inflacion * 0.8;

    expensa = Math.round(expensa * (1 + inflacion / 100));
    ingreso = Math.round(ingreso * (1 + ajusteIngreso / 100));

    const esfuerzo = (expensa / ingreso) * 100;
    if (esfuerzo >= UMBRAL_ESFUERZO_ROJO && mesZonaRoja === null) mesZonaRoja = mes;
    if (esfuerzo >= UMBRAL_ESFUERZO_AMARILLO && mesZonaAmarilla === null) mesZonaAmarilla = mes;

    curva.push({
      mes,
      inflacionAplicada: Math.round(inflacion * 100) / 100,
      expensaProyectadaCentavos: expensa,
      ingresoProyectadoCentavos: ingreso,
      esfuerzoPorcentaje: Math.round(esfuerzo * 100) / 100,
      zona: esfuerzo >= UMBRAL_ESFUERZO_ROJO ? 'roja' : esfuerzo >= UMBRAL_ESFUERZO_AMARILLO ? 'amarilla' : 'verde',
    });
  }

  return {
    curva,
    mesZonaAmarilla,
    mesZonaRoja,
    aguantaElPeriodo: mesZonaRoja === null,
    esfuerzoFinalPorcentaje: curva.at(-1)?.esfuerzoPorcentaje ?? 0,
    supuestos: {
      inflacionPromedioMensual: Math.round(promedioInflacion * 100) / 100,
      recomposicionSalarialPorcentaje,
      umbralRojo: UMBRAL_ESFUERZO_ROJO,
      umbralAmarillo: UMBRAL_ESFUERZO_AMARILLO,
    },
  };
}
