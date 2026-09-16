/**
 * Servicio de liquidacion: conecta el motor puro con Firestore.
 *
 * El motor (dominio/liquidacion.js) no sabe que existe Firebase. Este archivo
 * es el unico que traduce entre documentos y objetos planos. Esa separacion es
 * lo que permite testear el cierre exacto sin levantar un emulador.
 *
 * REGLA INVIOLABLE: si la verificacion de cierre no da exacta, el periodo NO se
 * cierra. La API devuelve 409 con la diferencia al centavo y no escribe nada.
 * Es preferible un periodo que no cierra a 152 expensas mal calculadas.
 */

import { db, rutas, FieldValue, aObjeto, aLista } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';
import { log } from '../infra/log.js';
import { liquidarPeriodo, armarCuentaCorriente, validarCoeficientes } from '../dominio/liquidacion.js';
import { calcularMoraDeCuenta, tramoDeMorosidad, TRAMOS_MOROSIDAD } from '../dominio/mora.js';
import { formatearPesos } from '../dominio/dinero.js';
import { deudaDePeriodo } from '../dominio/cuenta.js';

/** Tope de escrituras por lote en Firestore. */
const TOPE_LOTE = 450;

const aFecha = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);

/**
 * Calcula la liquidacion de un periodo sin escribir nada.
 * Es lo que consume la vista previa del panel: el admin ve como queda antes de
 * cerrar, y puede corregir un gasto sin haber tocado la cuenta de nadie.
 */
export async function calcularBorrador({ complejoId, periodoId, leer = (ref) => ref.get() }) {
  const [complejoSnap, periodoSnap, unidadesSnap] = await Promise.all([
    leer(rutas.complejo(complejoId)),
    leer(rutas.periodo(complejoId, periodoId)),
    leer(rutas.unidades(complejoId)),
  ]);

  const complejo = aObjeto(complejoSnap);
  const periodo = aObjeto(periodoSnap);
  if (!complejo) throw errores.noEncontrado('El complejo');
  if (!periodo) throw errores.noEncontrado('El periodo');

  const unidades = aLista(unidadesSnap).filter((u) => u.estado !== 'baja');
  if (unidades.length === 0) {
    throw errores.reglaDeNegocio(
      'SIN_UNIDADES',
      'El complejo no tiene unidades activas, no hay entre quienes prorratear.',
      null,
      'Cargá las unidades antes de liquidar.'
    );
  }

  const validacion = validarCoeficientes(unidades);
  if (!validacion.valido) {
    throw errores.reglaDeNegocio(
      'COEFICIENTES_NO_SUMAN',
      `Los coeficientes de las unidades suman ${validacion.sumaPorcentaje.toFixed(4)} % en vez de 100,0000 %.`,
      validacion,
      'Corregí los coeficientes en el ABM de unidades. Sin eso la liquidacion no puede cerrar exacta.'
    );
  }

  const liquidacion = liquidarPeriodo({
    unidades: unidades.map((u) => ({
      id: u.id,
      coeficiente: u.coeficiente,
      alquilada: Boolean(u.inquilinoUid),
    })),
    gastosOrdinarios: (periodo.gastosOrdinarios ?? []).map(normalizarGasto),
    gastosExtraordinarios: (periodo.gastosExtraordinarios ?? []).map(normalizarGasto),
    fondoReserva: periodo.fondoReserva ?? {
      modo: 'porcentaje',
      valor: complejo.porcentajeFondoReserva ?? 0,
    },
    politicaRedondeo: periodo.politicaRedondeo ?? complejo.politicaRedondeo ?? 'mayorResto',
  });

  // Saldos anteriores e intereses por mora, unidad por unidad.
  const vencimiento = aFecha(periodo.vencimiento) ?? new Date();
  const cuentas = await Promise.all(
    liquidacion.detalle.map(async (fila) => {
      const { saldoAnteriorCentavos, interesesCentavos } = await saldoYMora({
        complejoId, complejo, unidadId: fila.unidadId, hasta: vencimiento, excluirPeriodo: periodoId, leer,
      });
      const credito = Math.max(0, Number(unidades.find((u) => u.id === fila.unidadId).saldoAFavor ?? 0));
      const creditoAplicado = Math.min(credito, Math.max(0, fila.subtotalPeriodo));
      const cuenta = armarCuentaCorriente({
        detalleUnidad: fila,
        saldoAnteriorCentavos,
        interesesMoraCentavos: interesesCentavos,
      });
      return { ...cuenta, creditoAplicado, totalAPagar: cuenta.totalAPagar - creditoAplicado };
    })
  );

  const unidadesPorId = new Map(unidades.map((u) => [u.id, u]));

  return {
    periodoId,
    nomenclatura: complejo.nomenclaturaAporte ?? 'expensa',
    totales: liquidacion.totales,
    verificacion: liquidacion.verificacion,
    politicaRedondeo: liquidacion.politicaRedondeo,
    coeficientes: liquidacion.coeficientes,
    vencimiento: vencimiento.toISOString(),
    detalle: cuentas.map((c) => ({
      ...c,
      identificador: unidadesPorId.get(c.unidadId)?.identificador ?? c.unidadId,
    })),
  };
}

function normalizarGasto(gasto) {
  return {
    id: gasto.id,
    concepto: gasto.concepto,
    montoCentavos: Math.round(gasto.montoCentavos ?? 0),
    criterio: gasto.criterio ?? 'coeficiente',
    aCargoDe: gasto.aCargoDe ?? 'propietario',
    obraId: gasto.obraId ?? null,
  };
}

/**
 * Cierra el periodo: calcula, verifica el cierre exacto y escribe el detalle
 * por unidad. A partir de aca el residente ve su liquidacion y puede pagarla.
 *
 * Solo el admin del complejo puede hacerlo (lo controla la ruta), y un periodo
 * cerrado no se puede volver a cerrar: si hay que corregir algo se emite un
 * ajuste en el periodo siguiente, que es como funciona la contabilidad real.
 */
export async function cerrarPeriodo({ complejoId, periodoId, adminUid }) {
  return db.runTransaction(async (tx) => {
  // Pagos y cierres comparten este documento para serializar la cuenta.
  await tx.get(rutas.complejo(complejoId));
  const periodoActual = aObjeto(await tx.get(rutas.periodo(complejoId, periodoId)));
  if (!periodoActual) throw errores.noEncontrado('El periodo');
  if (periodoActual.estado === 'cerrado') {
    throw errores.conflicto(
      'Este periodo ya fue cerrado. Para corregirlo, emiti un ajuste en el periodo siguiente.',
      { cerradoEn: periodoActual.cerradoEn ?? null }
    );
  }

  const borrador = await calcularBorrador({ complejoId, periodoId, leer: (ref) => tx.get(ref) });
  if (borrador.detalle.length * 2 + 2 > TOPE_LOTE) {
    throw errores.conflicto('El complejo supera el limite de unidades para un cierre atomico. No se escribio ninguna liquidacion.');
  }

  // ---- LA VERIFICACION QUE SE MUESTRA EN LA DEMO --------------------------
  if (!borrador.verificacion.cierra) {
    throw errores.conflicto(
      'La liquidacion no cierra exacta. No se cerro el periodo ni se escribio ninguna expensa.',
      borrador.verificacion
    );
  }

  // Escritura en lotes: 152 unidades son 152 documentos de detalle.
  const lote = tx;

  for (const fila of borrador.detalle) {
    const ref = rutas.detalle(complejoId, periodoId).doc(fila.unidadId);
    lote.set(ref, {
      unidadId: fila.unidadId,
      identificador: fila.identificador,
      coeficiente: fila.coeficiente,
      montoOrdinario: fila.ordinario,
      montoExtraordinario: fila.extraordinario,
      fondoReserva: fila.fondoReserva,
      ajusteRedondeo: Math.round(fila.ajusteRedondeo * 100) / 100,
      aCargoPropietario: fila.aCargoPropietario,
      aCargoOcupante: fila.aCargoOcupante,
      subtotalPeriodo: fila.subtotalPeriodo,
      saldoAnterior: fila.saldoAnterior,
      interesesMora: fila.interesesMora,
      totalAPagar: fila.totalAPagar,
      versionCuenta: 2,
      creditoAplicado: fila.creditoAplicado,
      saldoPendiente: Math.max(0, fila.subtotalPeriodo - fila.creditoAplicado),
      interesesPendientes: 0,
      interesesGenerados: 0,
      pagado: fila.subtotalPeriodo - fila.creditoAplicado <= 0,
      detalleOrdinario: fila.detalleOrdinario,
      detalleExtraordinario: fila.detalleExtraordinario,
      creadoEn: FieldValue.serverTimestamp(),
    });

    const cambioCredito = -fila.creditoAplicado;
    if (cambioCredito !== 0) {
      tx.update(rutas.unidad(complejoId, fila.unidadId), { saldoAFavor: FieldValue.increment(cambioCredito) });
    }
  }

  lote.update(rutas.periodo(complejoId, periodoId), {
    estado: 'cerrado',
    totalLiquidado: borrador.totales.periodo,
    totalOrdinario: borrador.totales.ordinario,
    totalExtraordinario: borrador.totales.extraordinario,
    totalFondoReserva: borrador.totales.fondoReserva,
    cantidadUnidades: borrador.detalle.length,
    verificacionCierre: borrador.verificacion,
    cerradoEn: FieldValue.serverTimestamp(),
    cerradoPorUid: adminUid,
    actualizadoEn: FieldValue.serverTimestamp(),
  });
  tx.update(rutas.complejo(complejoId), { revisionCuenta: FieldValue.increment(1) });

  log.info('Periodo cerrado', {
    complejoId, periodoId, unidades: borrador.detalle.length,
    total: borrador.totales.periodo, cierra: borrador.verificacion.cierra,
  });

  return borrador;
  });
}

/**
 * Saldo pendiente e intereses de una unidad, mirando todos los periodos
 * cerrados anteriores.
 */
async function saldoYMora({ complejoId, complejo, unidadId, hasta, excluirPeriodo = null, leer = (ref) => ref.get() }) {
  const periodos = await leer(rutas.periodos(complejoId).where('estado', '==', 'cerrado'));

  const deudas = [];
  for (const periodoDoc of periodos.docs) {
    if (periodoDoc.id === excluirPeriodo) continue;
    const detalle = aObjeto(await leer(rutas.detalle(complejoId, periodoDoc.id).doc(unidadId)));
    if (!detalle) continue;
    const deuda = deudaDePeriodo({ detalle, periodo: aObjeto(periodoDoc), complejo, hasta });
    if (deuda.saldoCentavos + deuda.interesesCentavos > 0) deudas.push(deuda);
  }

  const saldoAnteriorCentavos = deudas.reduce((acc, d) => acc + d.saldoCentavos, 0);

  const mora = calcularMoraDeCuenta(deudas, {
    fechaCalculo: hasta,
    tasaMensualPorcentaje: complejo.tasaMoraMensual ?? 0,
    modo: complejo.modoMora ?? 'simple',
    diasGracia: complejo.diasGraciaMora ?? 0,
    topePorcentaje: complejo.topeMoraPorcentaje ?? 0,
  });

  return {
    saldoAnteriorCentavos,
    interesesCentavos: deudas.reduce((suma, d) => suma + d.interesesCentavos, 0),
    deudas,
    diasMaximos: deudas.reduce((max, d) => Math.max(max, d.dias), 0),
  };
}

/**
 * Estado de cuenta de una unidad: lo que ve el residente en la app y lo que
 * usa el checkout de Mercado Pago para saber cuanto cobrar.
 */
export async function estadoDeCuenta({ complejoId, unidadId, leer = (ref) => ref.get(), hasta = new Date() }) {
  const complejo = aObjeto(await leer(rutas.complejo(complejoId)));
  if (!complejo) throw errores.noEncontrado('El complejo');

  const unidad = aObjeto(await leer(rutas.unidad(complejoId, unidadId)));
  if (!unidad) throw errores.noEncontrado('La unidad');
  const periodosSnapshot = await leer(rutas.periodos(complejoId)
    .where('estado', '==', 'cerrado'));
  const periodos = periodosSnapshot.docs
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 12);

  const liquidaciones = [];
  for (const periodoDoc of periodos) {
    const detalle = aObjeto(await leer(rutas.detalle(complejoId, periodoDoc.id).doc(unidadId)));
    if (!detalle) continue;
    const periodo = periodoDoc.data();
    const deuda = deudaDePeriodo({ detalle, periodo: { ...periodo, id: periodoDoc.id }, complejo, hasta });
    liquidaciones.push({
      periodoId: periodoDoc.id,
      etiqueta: periodo.etiqueta ?? periodoDoc.id,
      vencimiento: aFecha(periodo.vencimiento)?.toISOString() ?? null,
      totalAPagar: detalle.totalAPagar,
      saldoPendiente: deuda.saldoCentavos + deuda.interesesCentavos,
      pagado: deuda.saldoCentavos + deuda.interesesCentavos === 0,
      montoOrdinario: detalle.montoOrdinario,
      montoExtraordinario: detalle.montoExtraordinario,
      fondoReserva: detalle.fondoReserva,
      interesesMora: detalle.interesesMora,
      saldoAnterior: detalle.saldoAnterior,
      detalleOrdinario: detalle.detalleOrdinario ?? [],
      detalleExtraordinario: detalle.detalleExtraordinario ?? [],
    });
  }

  const { saldoAnteriorCentavos, interesesCentavos, deudas, diasMaximos } = await saldoYMora({
    complejoId, complejo, unidadId, hasta, leer,
  });

  const proximo = liquidaciones.find((l) => !l.pagado) ?? null;

  return {
    unidadId,
    saldoAFavor: Math.max(0, Number(unidad.saldoAFavor ?? 0)),
    nomenclatura: complejo.nomenclaturaAporte ?? 'expensa',
    saldoPendiente: saldoAnteriorCentavos,
    interesesAcumulados: interesesCentavos,
    totalAdeudado: saldoAnteriorCentavos + interesesCentavos,
    diasDeMora: diasMaximos,
    tramoMorosidad: tramoDeMorosidad(diasMaximos),
    alDia: saldoAnteriorCentavos + interesesCentavos === 0,
    proximoVencimiento: proximo,
    liquidaciones,
    deudas,
  };
}

/**
 * Resumen de cobranza del complejo: los numeros del dashboard del panel.
 * Recaudacion del periodo, morosidad total y reparto por antiguedad.
 */
export async function resumenCobranza({ complejoId, periodoId = null }) {
  const complejo = aObjeto(await rutas.complejo(complejoId).get());
  if (!complejo) throw errores.noEncontrado('El complejo');

  const periodos = aLista(await rutas.periodos(complejoId).where('estado', '==', 'cerrado').get())
    .sort((a, b) => a.id.localeCompare(b.id));

  const ultimo = periodoId
    ? periodos.find((p) => p.id === periodoId)
    : periodos.at(-1);

  const porTramo = Object.fromEntries(TRAMOS_MOROSIDAD.map((t) => [t.clave, { monto: 0, unidades: 0 }]));
  let saldoPendienteTotal = 0;
  let unidadesConSaldo = 0;
  let morosidadTotal = 0;
  let unidadesMorosas = 0;
  let recaudado = 0;
  let liquidado = 0;

  const unidades = aLista(await rutas.unidades(complejoId).get()).filter((u) => u.estado !== 'baja');
  const detallesPorPeriodo = new Map(await Promise.all(periodos.map(async (periodo) => [
    periodo.id,
    aLista(await rutas.detalle(complejoId, periodo.id).get()),
  ])));
  const deudasPorUnidad = new Map();

  for (const periodo of periodos) {
    for (const detalle of detallesPorPeriodo.get(periodo.id) ?? []) {
      const deuda = deudaDePeriodo({ detalle, periodo, complejo });
      const saldoCentavos = deuda.saldoCentavos;
      if (saldoCentavos <= 0) continue;
      const deudas = deudasPorUnidad.get(detalle.id) ?? [];
      deudas.push({
        periodoId: periodo.id,
        saldoCentavos,
        vencimiento: aFecha(periodo.vencimiento) ?? new Date(),
      });
      deudasPorUnidad.set(detalle.id, deudas);
    }
  }

  for (const unidad of unidades) {
    const deudas = deudasPorUnidad.get(unidad.id) ?? [];
    const saldoAnteriorCentavos = deudas.reduce((total, deuda) => total + deuda.saldoCentavos, 0);
    const mora = calcularMoraDeCuenta(deudas, {
      fechaCalculo: new Date(),
      tasaMensualPorcentaje: complejo.tasaMoraMensual ?? 0,
      modo: complejo.modoMora ?? 'simple',
      diasGracia: complejo.diasGraciaMora ?? 0,
      topePorcentaje: complejo.topeMoraPorcentaje ?? 0,
    });
    if (saldoAnteriorCentavos > 0) {
      saldoPendienteTotal += saldoAnteriorCentavos;
      unidadesConSaldo += 1;
    }
    const deudasVencidas = mora.detalle.filter((deuda) => deuda.dias > 0);
    const capitalVencido = deudasVencidas.reduce((total, deuda) => total + deuda.saldoCentavos, 0);
    if (capitalVencido > 0) {
      const diasMaximos = deudasVencidas.reduce((maximo, deuda) => Math.max(maximo, deuda.dias), 0);
      morosidadTotal += capitalVencido;
      unidadesMorosas += 1;
      const tramo = tramoDeMorosidad(diasMaximos);
      if (porTramo[tramo]) {
        porTramo[tramo].monto += capitalVencido;
        porTramo[tramo].unidades += 1;
      }
    }
  }

  if (ultimo) {
    liquidado = ultimo.totalLiquidado ?? 0;
    const detalles = detallesPorPeriodo.get(ultimo.id) ?? [];
    recaudado = detalles.reduce((acc, d) => acc + ((d.subtotalPeriodo ?? d.totalAPagar) - (d.saldoPendiente ?? 0)), 0);
  }

  // Serie mensual para el grafico de barras del dashboard.
  const serie = [];
  for (const periodo of periodos.slice(-12)) {
    const detalles = detallesPorPeriodo.get(periodo.id) ?? [];
    const totalPeriodo = detalles.reduce((acc, d) => acc + (d.subtotalPeriodo ?? d.totalAPagar), 0);
    const pendiente = detalles.reduce((acc, d) => acc + (d.saldoPendiente ?? 0), 0);
    serie.push({
      periodoId: periodo.id,
      etiqueta: periodo.etiqueta ?? periodo.id,
      liquidado: totalPeriodo,
      recaudado: totalPeriodo - pendiente,
      pendiente,
    });
  }

  return {
    periodoId: ultimo?.id ?? null,
    nomenclatura: complejo.nomenclaturaAporte ?? 'expensa',
    cantidadUnidades: unidades.length,
    liquidado,
    recaudado,
    porcentajeRecaudado: liquidado > 0 ? Math.round((recaudado / liquidado) * 1000) / 10 : 0,
    saldoPendienteTotal,
    unidadesConSaldo,
    morosidadTotal,
    morosidadFormateada: formatearPesos(morosidadTotal),
    unidadesMorosas,
    porTramo: TRAMOS_MOROSIDAD.map((t) => ({
      clave: t.clave,
      etiqueta: t.etiqueta,
      monto: porTramo[t.clave].monto,
      unidades: porTramo[t.clave].unidades,
      porcentaje: morosidadTotal > 0
        ? Math.round((porTramo[t.clave].monto / morosidadTotal) * 1000) / 10 : 0,
    })),
    serie,
  };
}
