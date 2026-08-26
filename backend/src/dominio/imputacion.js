/**
 * Imputacion de pagos parciales.
 *
 * Cuando alguien debe tres meses y paga un monto que no alcanza para todo,
 * hay que decidir a que se aplica ese dinero. No es una decision libre: el
 * Codigo Civil y Comercial argentino (arts. 900 a 903) fija el orden y los
 * reglamentos de copropiedad lo repiten:
 *
 *   1. primero INTERESES,
 *   2. despues CAPITAL,
 *   3. y entre varias deudas, la MAS ANTIGUA primero,
 *   4. lo que sobre queda como SALDO A FAVOR para el periodo siguiente.
 *
 * Hacerlo al reves (capital primero) le conviene al deudor y perjudica al
 * consorcio, y es el error mas comun de las planillas de Excel del rubro.
 *
 * Funcion pura, en centavos enteros, sin dependencias.
 */

/**
 * @param {object} entrada
 * @param {number} entrada.montoCentavos  Lo que efectivamente entro.
 * @param {Array<{periodoId:string, vencimiento:Date|string, capitalCentavos:number, interesesCentavos:number}>} entrada.deudas
 *        No hace falta que vengan ordenadas: se ordenan por vencimiento.
 * @returns {{aIntereses:number, aCapital:number, aSaldoFuturo:number, aplicaciones:Array, deudaRestante:number, cancelaTodo:boolean}}
 */
export function imputarPago({ montoCentavos, deudas = [] }) {
  if (!Number.isInteger(montoCentavos) || montoCentavos <= 0) {
    throw new RangeError('El monto a imputar tiene que ser un entero de centavos mayor a cero');
  }

  const pendientes = deudas
    .map((d) => ({
      periodoId: d.periodoId,
      vencimiento: d.vencimiento instanceof Date ? d.vencimiento : new Date(d.vencimiento),
      capital: Math.max(0, Math.round(d.capitalCentavos ?? 0)),
      intereses: Math.max(0, Math.round(d.interesesCentavos ?? 0)),
    }))
    .filter((d) => d.capital > 0 || d.intereses > 0)
    .sort((a, b) => {
      const diff = a.vencimiento.getTime() - b.vencimiento.getTime();
      // Desempate por periodoId para que la imputacion sea determinista.
      return diff !== 0 ? diff : (a.periodoId < b.periodoId ? -1 : 1);
    });

  let restante = montoCentavos;
  let aIntereses = 0;
  let aCapital = 0;
  const aplicaciones = [];

  const aplicar = (deuda, campo, etiqueta) => {
    if (restante <= 0 || deuda[campo] <= 0) return;
    const monto = Math.min(restante, deuda[campo]);
    deuda[campo] -= monto;
    restante -= monto;
    if (campo === 'intereses') aIntereses += monto; else aCapital += monto;
    aplicaciones.push({ periodoId: deuda.periodoId, concepto: etiqueta, montoCentavos: monto });
  };

  // Paso 1: todos los intereses, de la deuda mas vieja a la mas nueva.
  for (const deuda of pendientes) aplicar(deuda, 'intereses', 'intereses');
  // Paso 2: recien ahi el capital, en el mismo orden.
  for (const deuda of pendientes) aplicar(deuda, 'capital', 'capital');

  const deudaRestante = pendientes.reduce((acc, d) => acc + d.capital + d.intereses, 0);

  return {
    aIntereses,
    aCapital,
    aSaldoFuturo: restante,
    aplicaciones,
    deudaRestante,
    cancelaTodo: deudaRestante === 0,
    /** Como queda cada periodo despues del pago. Es lo que se escribe en Firestore. */
    periodos: pendientes.map((d) => ({
      periodoId: d.periodoId,
      capitalRestante: d.capital,
      interesesRestantes: d.intereses,
      cancelado: d.capital === 0 && d.intereses === 0,
    })),
  };
}
