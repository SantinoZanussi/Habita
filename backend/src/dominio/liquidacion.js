/**
 * NUCLEO 1 - Motor de liquidacion de expensas.
 *
 * Es la parte del rubro que nadie resuelve bien y la que mas dolor genera.
 * Lo que tiene que hacer:
 *
 *   - prorratear los gastos por coeficiente de cada unidad;
 *   - separar gastos ORDINARIOS de EXTRAORDINARIOS, que se dividen con
 *     criterios distintos y a veces los paga el propietario y no el inquilino;
 *   - aportar al fondo de reserva;
 *   - dejar todo listo para sumarle intereses por mora y saldo anterior.
 *
 * LA RESTRICCION DURA:
 *   la suma de las liquidaciones individuales tiene que dar EXACTAMENTE el
 *   gasto total del periodo. Los centavos que sobran del redondeo se reparten
 *   segun una politica explicita y configurable, no se pierden.
 *
 * El motor es una funcion pura: entra un objeto plano, sale un objeto plano.
 * No sabe que existe Firestore. Por eso se puede testear sin levantar nada y
 * por eso se puede explicar linea por linea en la defensa.
 */

import { COEFICIENTE_TOTAL, aCoeficienteEntero, repartirExacto, verificarCierre } from './dinero.js';

/** Criterios con los que se puede repartir un gasto entre las unidades. */
export const CRITERIOS = Object.freeze({
  /** Segun el coeficiente de copropiedad de cada unidad. Es el caso normal. */
  COEFICIENTE: 'coeficiente',
  /** En partes iguales. Se usa para gastos que no dependen de la superficie
   *  (por ejemplo el servicio de un portero electronico por unidad). */
  PARTES_IGUALES: 'partesIguales',
});

/** A quien se le imputa el gasto cuando la unidad esta alquilada. */
export const A_CARGO_DE = Object.freeze({
  PROPIETARIO: 'propietario',
  OCUPANTE: 'ocupante',
});

export const POLITICAS_REDONDEO = Object.freeze({
  /** Los centavos sobrantes van a las unidades con mayor resto fraccionario. */
  MAYOR_RESTO: 'mayorResto',
  /** Los centavos sobrantes van a las unidades con mayor coeficiente. */
  MAYOR_COEFICIENTE: 'mayorCoeficiente',
});

/**
 * Valida que los coeficientes de las unidades sumen 100 % exacto.
 * Si no suman, no se liquida: un reglamento de copropiedad mal cargado
 * produce expensas mal calculadas para siempre, y es preferible fallar
 * ruidosamente al cargar las unidades que descubrirlo tres meses despues.
 */
export function validarCoeficientes(unidades) {
  const filas = unidades.map((u) => ({
    id: u.id,
    coeficienteEntero: aCoeficienteEntero(u.coeficiente),
  }));
  const suma = filas.reduce((acc, f) => acc + f.coeficienteEntero, 0);
  return {
    valido: suma === COEFICIENTE_TOTAL,
    suma,
    sumaPorcentaje: suma / 10_000,
    diferencia: suma - COEFICIENTE_TOTAL,
    diferenciaPorcentaje: (suma - COEFICIENTE_TOTAL) / 10_000,
    cantidadUnidades: filas.length,
  };
}

/**
 * Liquida un periodo completo.
 *
 * @param {object} entrada
 * @param {Array<{id:string, coeficiente:number, alquilada?:boolean}>} entrada.unidades
 *        Coeficiente en porcentaje decimal (2.5641). Deben sumar 100.
 * @param {Array<{id:string, concepto:string, montoCentavos:number, criterio?:string}>} entrada.gastosOrdinarios
 * @param {Array<{id:string, concepto:string, montoCentavos:number, criterio?:string, aCargoDe?:string, obraId?:string}>} entrada.gastosExtraordinarios
 * @param {{modo:'porcentaje'|'monto', valor:number}} [entrada.fondoReserva]
 *        `porcentaje` se aplica sobre el total de gastos ordinarios.
 * @param {string} [entrada.politicaRedondeo]
 * @returns {object} Liquidacion con el detalle por unidad y la verificacion de cierre.
 */
export function liquidarPeriodo({
  unidades,
  gastosOrdinarios = [],
  gastosExtraordinarios = [],
  fondoReserva = { modo: 'porcentaje', valor: 0 },
  politicaRedondeo = POLITICAS_REDONDEO.MAYOR_RESTO,
}) {
  if (!Array.isArray(unidades) || unidades.length === 0) {
    throw new RangeError('No hay unidades para liquidar el periodo');
  }

  const validacion = validarCoeficientes(unidades);
  if (!validacion.valido) {
    throw new RangeError(
      `Los coeficientes suman ${validacion.sumaPorcentaje.toFixed(4)} % y tienen que sumar 100,0000 %. ` +
      `Diferencia: ${validacion.diferenciaPorcentaje.toFixed(4)} %.`
    );
  }

  const filas = unidades.map((u) => ({
    id: u.id,
    coeficiente: u.coeficiente,
    coeficienteEntero: aCoeficienteEntero(u.coeficiente),
    alquilada: Boolean(u.alquilada),
  }));

  // Acumuladores por unidad. Todo en centavos enteros.
  const acumulado = new Map(
    filas.map((f) => [f.id, {
      unidadId: f.id,
      coeficiente: f.coeficiente,
      ordinario: 0,
      extraordinario: 0,
      fondoReserva: 0,
      aCargoPropietario: 0,
      aCargoOcupante: 0,
      ajusteRedondeo: 0,
      detalleOrdinario: [],
      detalleExtraordinario: [],
    }])
  );

  const pesosDe = (criterio) =>
    criterio === CRITERIOS.PARTES_IGUALES
      ? filas.map((f) => ({ id: f.id, peso: 1 }))
      : filas.map((f) => ({ id: f.id, peso: f.coeficienteEntero }));

  /** Reparte un gasto y lo acumula en la categoria que corresponda. */
  const repartirGasto = (gasto, categoria) => {
    const criterio = gasto.criterio ?? CRITERIOS.COEFICIENTE;
    const aCargoDe = categoria === 'extraordinario'
      ? (gasto.aCargoDe ?? A_CARGO_DE.PROPIETARIO)
      : A_CARGO_DE.OCUPANTE;

    const reparto = repartirExacto(gasto.montoCentavos, pesosDe(criterio), { politica: politicaRedondeo });

    for (const parte of reparto) {
      const acc = acumulado.get(parte.id);
      acc[categoria] += parte.monto;
      acc.ajusteRedondeo += parte.ajuste;
      // Una unidad que no esta alquilada no distingue propietario de ocupante:
      // es la misma persona y se le imputa todo junto.
      if (aCargoDe === A_CARGO_DE.OCUPANTE) acc.aCargoOcupante += parte.monto;
      else acc.aCargoPropietario += parte.monto;

      const destino = categoria === 'ordinario' ? acc.detalleOrdinario : acc.detalleExtraordinario;
      destino.push({
        gastoId: gasto.id,
        concepto: gasto.concepto,
        criterio,
        aCargoDe,
        obraId: gasto.obraId ?? null,
        montoCentavos: parte.monto,
      });
    }
  };

  for (const gasto of gastosOrdinarios) repartirGasto(gasto, 'ordinario');
  for (const gasto of gastosExtraordinarios) repartirGasto(gasto, 'extraordinario');

  // --- fondo de reserva ---------------------------------------------------
  const totalOrdinario = gastosOrdinarios.reduce((acc, g) => acc + g.montoCentavos, 0);
  const totalExtraordinario = gastosExtraordinarios.reduce((acc, g) => acc + g.montoCentavos, 0);

  const montoFondo = fondoReserva.modo === 'monto'
    ? Math.round(fondoReserva.valor)
    : Math.round((totalOrdinario * aCoeficienteEntero(fondoReserva.valor ?? 0)) / COEFICIENTE_TOTAL);

  if (montoFondo !== 0) {
    const reparto = repartirExacto(montoFondo, pesosDe(CRITERIOS.COEFICIENTE), { politica: politicaRedondeo });
    for (const parte of reparto) {
      const acc = acumulado.get(parte.id);
      acc.fondoReserva += parte.monto;
      acc.ajusteRedondeo += parte.ajuste;
      acc.aCargoOcupante += parte.monto;
    }
  }

  // --- verificacion de cierre --------------------------------------------
  // Esto es lo que se proyecta en la demo. Si alguna de las tres no cierra,
  // el periodo no se puede cerrar y la API devuelve 409.
  const detalle = [...acumulado.values()].map((d) => ({
    ...d,
    subtotalPeriodo: d.ordinario + d.extraordinario + d.fondoReserva,
  }));

  const verificacion = {
    ordinario: verificarCierre(totalOrdinario, detalle.map((d) => d.ordinario)),
    extraordinario: verificarCierre(totalExtraordinario, detalle.map((d) => d.extraordinario)),
    fondoReserva: verificarCierre(montoFondo, detalle.map((d) => d.fondoReserva)),
  };
  const totalPeriodo = totalOrdinario + totalExtraordinario + montoFondo;
  verificacion.total = verificarCierre(totalPeriodo, detalle.map((d) => d.subtotalPeriodo));
  verificacion.cierra =
    verificacion.ordinario.cierra &&
    verificacion.extraordinario.cierra &&
    verificacion.fondoReserva.cierra &&
    verificacion.total.cierra;

  return {
    politicaRedondeo,
    totales: {
      ordinario: totalOrdinario,
      extraordinario: totalExtraordinario,
      fondoReserva: montoFondo,
      periodo: totalPeriodo,
    },
    coeficientes: validacion,
    detalle: detalle.sort((a, b) => (a.unidadId < b.unidadId ? -1 : 1)),
    verificacion,
  };
}

/**
 * Cierra la liquidacion de una unidad sumandole lo que arrastra de antes.
 * Se mantiene separado del prorrateo porque son dos cosas distintas: el
 * prorrateo reparte el gasto del mes, esto arma la cuenta corriente.
 *
 * @param {object} entrada
 * @param {object} entrada.detalleUnidad  Fila devuelta por liquidarPeriodo.
 * @param {number} entrada.saldoAnteriorCentavos  Positivo = deuda; negativo = saldo a favor.
 * @param {number} entrada.interesesMoraCentavos
 */
export function armarCuentaCorriente({ detalleUnidad, saldoAnteriorCentavos = 0, interesesMoraCentavos = 0 }) {
  const totalAPagar =
    detalleUnidad.subtotalPeriodo + saldoAnteriorCentavos + interesesMoraCentavos;
  return {
    ...detalleUnidad,
    saldoAnterior: saldoAnteriorCentavos,
    interesesMora: interesesMoraCentavos,
    // Un saldo a favor grande puede dejar el total en negativo: no se cobra,
    // se arrastra. Nunca se le pide plata a alguien que tiene credito.
    totalAPagar,
    aFavor: totalAPagar < 0 ? -totalAPagar : 0,
  };
}
