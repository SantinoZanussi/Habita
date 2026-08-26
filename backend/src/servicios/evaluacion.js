/** Modulo opcional de evaluacion de ingresantes. */

import { rutas, FieldValue, aObjeto } from '../infra/firebase.js';
import { calcularScore, proyectarCurvaDeEsfuerzo } from '../dominio/scoring.js';
import { proyeccionInflacion } from '../externos/bcra.js';

export async function evaluarCandidato({ complejoId, datos, actorUid }) {
  const inflacion = await proyeccionInflacion(datos.meses ?? 18).catch(() => ({ mensual: Array(datos.meses ?? 18).fill(3) }));
  const entrada = {
    ingresoMensualCentavos: Math.round(Number(datos.ingresoMensual) * 100),
    expensaMensualCentavos: Math.round(Number(datos.expensaMensual) * 100),
    tipoGarantia: datos.tipoGarantia,
    integrantesGrupo: Number(datos.integrantesGrupo),
    superficieM2: Number(datos.superficieM2 ?? 0),
  };
  const scoring = calcularScore(entrada);
  const proyeccion = proyectarCurvaDeEsfuerzo({
    ...entrada,
    inflacionMensualPorcentaje: inflacion.mensual ?? inflacion,
    meses: Number(datos.meses ?? 18),
  });
  const ref = rutas.candidatos(complejoId).doc();
  await ref.set({
    ...datos,
    ingresoMensualCentavos: entrada.ingresoMensualCentavos,
    expensaMensualCentavos: entrada.expensaMensualCentavos,
    score: scoring.score,
    desglose: scoring,
    proyeccion,
    estado: 'evaluando',
    creadoPorUid: actorUid,
    creadoEn: FieldValue.serverTimestamp(),
  });
  return aObjeto(await ref.get());
}
