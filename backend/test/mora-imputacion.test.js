import test from 'node:test';
import assert from 'node:assert/strict';

import { calcularMora, calcularMoraDeCuenta, diasCorridos, tramoDeMorosidad, MODOS_MORA } from '../src/dominio/mora.js';
import { imputarPago } from '../src/dominio/imputacion.js';

const f = (iso) => new Date(`${iso}T12:00:00Z`);

test('no hay interes antes del vencimiento ni sobre saldo a favor', () => {
  assert.equal(calcularMora({
    saldoCentavos: 100_000, vencimiento: f('2026-08-10'), fechaCalculo: f('2026-08-05'),
    tasaMensualPorcentaje: 3,
  }).interesCentavos, 0);

  assert.equal(calcularMora({
    saldoCentavos: -50_000, vencimiento: f('2026-07-10'), fechaCalculo: f('2026-08-10'),
    tasaMensualPorcentaje: 3,
  }).interesCentavos, 0);
});

test('interes simple: 3 % mensual a 30 dias es exactamente 3 %', () => {
  const resultado = calcularMora({
    saldoCentavos: 1_000_000, vencimiento: f('2026-07-10'), fechaCalculo: f('2026-08-09'),
    tasaMensualPorcentaje: 3, modo: MODOS_MORA.SIMPLE,
  });
  assert.equal(resultado.dias, 30);
  assert.equal(resultado.interesCentavos, 30_000);
});

test('interes simple: se prorratea por dia', () => {
  const resultado = calcularMora({
    saldoCentavos: 1_000_000, vencimiento: f('2026-07-10'), fechaCalculo: f('2026-07-25'),
    tasaMensualPorcentaje: 3,
  });
  assert.equal(resultado.dias, 15);
  assert.equal(resultado.interesCentavos, 15_000);
});

test('interes compuesto capitaliza y da mas que el simple en el largo plazo', () => {
  const comun = { saldoCentavos: 1_000_000, vencimiento: f('2026-01-10'), fechaCalculo: f('2026-07-10'), tasaMensualPorcentaje: 5 };
  const simple = calcularMora({ ...comun, modo: MODOS_MORA.SIMPLE });
  const compuesta = calcularMora({ ...comun, modo: MODOS_MORA.COMPUESTA });
  assert.ok(compuesta.interesCentavos > simple.interesCentavos);
});

test('los dias de gracia no devengan interes', () => {
  const resultado = calcularMora({
    saldoCentavos: 1_000_000, vencimiento: f('2026-07-10'), fechaCalculo: f('2026-07-15'),
    tasaMensualPorcentaje: 3, diasGracia: 5,
  });
  assert.equal(resultado.interesCentavos, 0);
});

test('el tope legal corta el interes', () => {
  const resultado = calcularMora({
    saldoCentavos: 1_000_000, vencimiento: f('2025-01-10'), fechaCalculo: f('2026-08-10'),
    tasaMensualPorcentaje: 10, topePorcentaje: 50,
  });
  assert.equal(resultado.interesCentavos, 500_000);
  assert.equal(resultado.topeAplicado, true);
});

test('calcularMoraDeCuenta suma varios periodos vencidos', () => {
  const resultado = calcularMoraDeCuenta(
    [
      { periodoId: '2026-05', saldoCentavos: 500_000, vencimiento: f('2026-05-10') },
      { periodoId: '2026-06', saldoCentavos: 500_000, vencimiento: f('2026-06-10') },
      { periodoId: '2026-07', saldoCentavos: 0, vencimiento: f('2026-07-10') },
    ],
    { fechaCalculo: f('2026-08-09'), tasaMensualPorcentaje: 3 }
  );
  assert.equal(resultado.detalle.length, 2, 'el periodo sin saldo no entra');
  assert.equal(resultado.capitalVencidoCentavos, 1_000_000);
  assert.equal(resultado.diasMaximos, diasCorridos(f('2026-05-10'), f('2026-08-09')));
  assert.ok(resultado.interesTotalCentavos > 0);
});

test('los tramos de morosidad son los del grafico del panel', () => {
  assert.equal(tramoDeMorosidad(0), 'alDia');
  assert.equal(tramoDeMorosidad(15), 'hasta30');
  assert.equal(tramoDeMorosidad(45), 'de31a60');
  assert.equal(tramoDeMorosidad(75), 'de61a90');
  assert.equal(tramoDeMorosidad(200), 'masDe90');
});

// ---------------------------------------------------------------- imputacion

test('un pago parcial va primero a intereses y despues a capital', () => {
  const resultado = imputarPago({
    montoCentavos: 50_000,
    deudas: [{ periodoId: '2026-06', vencimiento: f('2026-06-10'), capitalCentavos: 300_000, interesesCentavos: 20_000 }],
  });
  assert.equal(resultado.aIntereses, 20_000);
  assert.equal(resultado.aCapital, 30_000);
  assert.equal(resultado.aSaldoFuturo, 0);
  assert.equal(resultado.deudaRestante, 270_000);
  assert.equal(resultado.cancelaTodo, false);
});

test('con varias deudas cancela TODOS los intereses antes de tocar capital', () => {
  const resultado = imputarPago({
    montoCentavos: 60_000,
    deudas: [
      { periodoId: '2026-07', vencimiento: f('2026-07-10'), capitalCentavos: 200_000, interesesCentavos: 10_000 },
      { periodoId: '2026-05', vencimiento: f('2026-05-10'), capitalCentavos: 200_000, interesesCentavos: 30_000 },
      { periodoId: '2026-06', vencimiento: f('2026-06-10'), capitalCentavos: 200_000, interesesCentavos: 20_000 },
    ],
  });
  assert.equal(resultado.aIntereses, 60_000, 'los tres intereses suman 60.000 y se cancelan enteros');
  assert.equal(resultado.aCapital, 0);
});

test('entre varias deudas se paga primero la mas antigua', () => {
  const resultado = imputarPago({
    montoCentavos: 250_000,
    deudas: [
      { periodoId: '2026-07', vencimiento: f('2026-07-10'), capitalCentavos: 200_000, interesesCentavos: 0 },
      { periodoId: '2026-05', vencimiento: f('2026-05-10'), capitalCentavos: 200_000, interesesCentavos: 0 },
    ],
  });
  const mayo = resultado.periodos.find((p) => p.periodoId === '2026-05');
  const julio = resultado.periodos.find((p) => p.periodoId === '2026-07');
  assert.equal(mayo.cancelado, true, 'mayo se cancela primero');
  assert.equal(julio.capitalRestante, 150_000);
});

test('lo que sobra queda como saldo a favor', () => {
  const resultado = imputarPago({
    montoCentavos: 500_000,
    deudas: [{ periodoId: '2026-07', vencimiento: f('2026-07-10'), capitalCentavos: 200_000, interesesCentavos: 15_000 }],
  });
  assert.equal(resultado.aSaldoFuturo, 285_000);
  assert.equal(resultado.cancelaTodo, true);
});

test('la imputacion no pierde ni inventa un centavo', () => {
  const monto = 137_777;
  const resultado = imputarPago({
    montoCentavos: monto,
    deudas: [
      { periodoId: '2026-05', vencimiento: f('2026-05-10'), capitalCentavos: 51_111, interesesCentavos: 3_333 },
      { periodoId: '2026-06', vencimiento: f('2026-06-10'), capitalCentavos: 47_777, interesesCentavos: 1_111 },
    ],
  });
  assert.equal(resultado.aIntereses + resultado.aCapital + resultado.aSaldoFuturo, monto);
});

test('un pago sin deudas queda entero como saldo a favor', () => {
  const resultado = imputarPago({ montoCentavos: 100_000, deudas: [] });
  assert.equal(resultado.aSaldoFuturo, 100_000);
  assert.equal(resultado.cancelaTodo, true);
});

test('rechaza importes invalidos en vez de escribir un pago corrupto', () => {
  assert.throws(() => imputarPago({ montoCentavos: 0, deudas: [] }), /mayor a cero/);
  assert.throws(() => imputarPago({ montoCentavos: -100, deudas: [] }), /mayor a cero/);
  assert.throws(() => imputarPago({ montoCentavos: 10.5, deudas: [] }), /entero de centavos/);
});
