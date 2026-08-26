/**
 * API del BCRA - serie de inflacion mensual.
 *
 * Se usa en dos lugares:
 *   - modulo Evaluacion: proyectar la expensa mes a mes para armar la curva de
 *     esfuerzo del candidato;
 *   - panel de expensas: sugerir el ajuste del periodo contra el indice real
 *     en vez de un porcentaje inventado.
 *
 * Es una API publica y gratuita, sin API key. Como cualquier servicio externo
 * puede estar caido, el modulo cachea la ultima respuesta buena en memoria y,
 * si tampoco hay cache, cae a una serie de respaldo. La proyeccion sale igual
 * y queda marcado de donde salio el dato: un numero sin procedencia no sirve
 * para tomar una decision.
 */

import { entorno } from '../config/entorno.js';
import { log } from '../infra/log.js';
import { pedirJson } from '../infra/reintento.js';

/**
 * Serie de respaldo: variacion mensual del IPC en Argentina.
 * Se usa solo si el BCRA no responde y no hay nada cacheado. Los valores estan
 * a proposito del lado conservador (inflacion alta), porque en una evaluacion
 * de riesgo equivocarse por optimista es peor que por pesimista.
 */
const SERIE_RESPALDO = [
  { fecha: '2026-02-01', valor: 2.4 }, { fecha: '2026-03-01', valor: 2.6 },
  { fecha: '2026-04-01', valor: 2.2 }, { fecha: '2026-05-01', valor: 2.1 },
  { fecha: '2026-06-01', valor: 1.9 }, { fecha: '2026-07-01', valor: 2.0 },
];

const CACHE_MS = 6 * 60 * 60 * 1000;   // el IPC se publica una vez por mes
let cache = { serie: null, guardadoEn: 0 };

/**
 * Trae la serie de inflacion mensual.
 * @param {number} meses Cuantos meses hacia atras pedir.
 */
export async function serieInflacionMensual(meses = 12) {
  const ahora = Date.now();
  if (cache.serie && ahora - cache.guardadoEn < CACHE_MS) {
    return { ...cache.serie, origen: 'cache' };
  }

  const hasta = new Date();
  const desde = new Date(hasta.getTime());
  desde.setMonth(desde.getMonth() - meses);
  const iso = (f) => f.toISOString().slice(0, 10);

  const url = `${entorno.bcra.urlBase}/monetarias/${entorno.bcra.idSerieInflacion}` +
              `?desde=${iso(desde)}&hasta=${iso(hasta)}&limit=${Math.max(meses, 12)}`;

  try {
    const respuesta = await pedirJson(url, {
      nombre: 'BCRA',
      timeoutMs: entorno.bcra.timeoutMs,
      intentos: 2,
      headers: { 'Accept': 'application/json' },
    });

    const datos = (respuesta?.results ?? [])
      .map((r) => ({ fecha: r.fecha, valor: Number(r.valor) }))
      .filter((r) => Number.isFinite(r.valor))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    if (datos.length === 0) throw new Error('El BCRA respondio sin datos');

    const resultado = {
      serie: datos,
      valores: datos.map((d) => d.valor),
      ultimoValor: datos.at(-1).valor,
      ultimaFecha: datos.at(-1).fecha,
      promedio: Math.round((datos.reduce((a, d) => a + d.valor, 0) / datos.length) * 100) / 100,
      origen: 'bcra',
      consultadoEn: new Date().toISOString(),
    };

    cache = { serie: resultado, guardadoEn: ahora };
    log.info('Serie de inflacion actualizada desde el BCRA', {
      puntos: datos.length, ultimo: resultado.ultimoValor,
    });
    return resultado;
  } catch (error) {
    log.aviso('El BCRA no respondio, se usa el respaldo', { motivo: error.message });

    if (cache.serie) return { ...cache.serie, origen: 'cache_vencida' };

    return {
      serie: SERIE_RESPALDO,
      valores: SERIE_RESPALDO.map((d) => d.valor),
      ultimoValor: SERIE_RESPALDO.at(-1).valor,
      ultimaFecha: SERIE_RESPALDO.at(-1).fecha,
      promedio: Math.round((SERIE_RESPALDO.reduce((a, d) => a + d.valor, 0) / SERIE_RESPALDO.length) * 100) / 100,
      origen: 'respaldo',
      advertencia: 'El BCRA no respondio. La proyeccion usa una serie de respaldo, no datos oficiales del dia.',
      consultadoEn: new Date().toISOString(),
    };
  }
}

/**
 * Proyecta la inflacion de los proximos `meses` a partir de la serie real.
 * Usa el promedio de los ultimos seis meses: proyectar con el ultimo dato solo
 * amplifica el ruido de un mes atipico.
 */
export async function proyeccionInflacion(meses = 18) {
  const serie = await serieInflacionMensual(12);
  const ultimos = serie.valores.slice(-6);
  const promedio = ultimos.reduce((a, b) => a + b, 0) / (ultimos.length || 1);

  return {
    mensual: Array.from({ length: meses }, () => Math.round(promedio * 100) / 100),
    promedioMensual: Math.round(promedio * 100) / 100,
    origen: serie.origen,
    ultimaFecha: serie.ultimaFecha,
    advertencia: serie.advertencia ?? null,
  };
}
