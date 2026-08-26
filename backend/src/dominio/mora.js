/**
 * Intereses por mora sobre saldos vencidos.
 *
 * La expensa vence un dia fijo del mes. A partir de ahi el saldo impago
 * devenga interes. El reglamento de cada complejo fija la tasa, asi que la
 * tasa es configuracion, no constante del codigo.
 *
 * Dos modos, porque los reglamentos usan los dos:
 *   - simple:    interes proporcional a los dias corridos sobre el saldo original.
 *   - compuesta: capitaliza mes a mes (el interes del mes 1 devenga interes en el mes 2).
 *
 * Todo en centavos enteros, con redondeo a la mitad hacia arriba al final.
 */

import { redondearCentavos } from './dinero.js';

const DIAS_DEL_MES = 30;

export const MODOS_MORA = Object.freeze({ SIMPLE: 'simple', COMPUESTA: 'compuesta' });

/** Dias corridos entre dos fechas, sin importar la hora del dia. */
export function diasCorridos(desde, hasta) {
  const a = Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  const b = Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate());
  return Math.floor((b - a) / 86_400_000);
}

/**
 * Calcula el interes por mora de un saldo.
 *
 * @param {object} entrada
 * @param {number} entrada.saldoCentavos      Saldo vencido (positivo = deuda).
 * @param {Date}   entrada.vencimiento
 * @param {Date}   entrada.fechaCalculo
 * @param {number} entrada.tasaMensualPorcentaje  Ej: 3.5 para 3,5 % mensual.
 * @param {string} [entrada.modo]
 * @param {number} [entrada.diasGracia]       Dias posteriores al vencimiento sin interes.
 * @param {number} [entrada.topePorcentaje]   Tope del interes como % del capital. 0 = sin tope.
 */
export function calcularMora({
  saldoCentavos,
  vencimiento,
  fechaCalculo,
  tasaMensualPorcentaje,
  modo = MODOS_MORA.SIMPLE,
  diasGracia = 0,
  topePorcentaje = 0,
}) {
  const vacio = {
    interesCentavos: 0, dias: 0, diasPunibles: 0,
    tasaMensualPorcentaje, modo, topeAplicado: false,
  };

  // A un saldo a favor o en cero no se le cobra interes.
  if (!Number.isFinite(saldoCentavos) || saldoCentavos <= 0) return vacio;
  if (!(vencimiento instanceof Date) || !(fechaCalculo instanceof Date)) {
    throw new TypeError('calcularMora necesita fechas validas');
  }

  const dias = diasCorridos(vencimiento, fechaCalculo);
  if (dias <= diasGracia) return { ...vacio, dias: Math.max(dias, 0) };

  const diasPunibles = dias - diasGracia;
  const tasa = tasaMensualPorcentaje / 100;

  let interes;
  if (modo === MODOS_MORA.COMPUESTA) {
    interes = saldoCentavos * (Math.pow(1 + tasa, diasPunibles / DIAS_DEL_MES) - 1);
  } else {
    interes = saldoCentavos * tasa * (diasPunibles / DIAS_DEL_MES);
  }

  let topeAplicado = false;
  if (topePorcentaje > 0) {
    const tope = saldoCentavos * (topePorcentaje / 100);
    if (interes > tope) {
      interes = tope;
      topeAplicado = true;
    }
  }

  return {
    interesCentavos: redondearCentavos(interes),
    dias,
    diasPunibles,
    tasaMensualPorcentaje,
    modo,
    topeAplicado,
  };
}

/**
 * Calcula la mora de una cuenta corriente completa: una unidad puede arrastrar
 * varios periodos vencidos, cada uno con su propia antiguedad.
 *
 * @param {Array<{periodoId:string, saldoCentavos:number, vencimiento:Date}>} deudas
 */
export function calcularMoraDeCuenta(deudas, opciones) {
  const detalle = deudas
    .filter((d) => d.saldoCentavos > 0)
    .map((d) => ({
      periodoId: d.periodoId,
      saldoCentavos: d.saldoCentavos,
      ...calcularMora({ ...opciones, saldoCentavos: d.saldoCentavos, vencimiento: d.vencimiento }),
    }));

  return {
    detalle,
    interesTotalCentavos: detalle.reduce((acc, d) => acc + d.interesCentavos, 0),
    capitalVencidoCentavos: detalle.reduce((acc, d) => acc + d.saldoCentavos, 0),
    /** Antiguedad de la deuda mas vieja: es lo que ordena el panel de morosidad. */
    diasMaximos: detalle.reduce((acc, d) => Math.max(acc, d.dias), 0),
  };
}

/**
 * Clasifica una deuda por antiguedad. Son los tramos que muestra el grafico
 * de morosidad del panel, y los mismos que usa cualquier estudio de cobranza.
 */
export function tramoDeMorosidad(dias) {
  if (dias <= 0) return 'alDia';
  if (dias <= 30) return 'hasta30';
  if (dias <= 60) return 'de31a60';
  if (dias <= 90) return 'de61a90';
  return 'masDe90';
}

export const TRAMOS_MOROSIDAD = Object.freeze([
  { clave: 'hasta30', etiqueta: '0 a 30 dias' },
  { clave: 'de31a60', etiqueta: '31 a 60 dias' },
  { clave: 'de61a90', etiqueta: '61 a 90 dias' },
  { clave: 'masDe90', etiqueta: 'mas de 90 dias' },
]);
