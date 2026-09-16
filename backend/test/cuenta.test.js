import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deudaDePeriodo } from '../src/dominio/cuenta.js';

const periodo = { id: '2026-01', vencimiento: '2026-01-01' };
const complejo = { tasaMoraMensual: 3, modoMora: 'simple' };

test('el interes ya liquidado no se cobra otra vez y el capital conserva su antiguedad', () => {
  const deuda = deudaDePeriodo({ periodo, complejo, hasta: new Date('2026-03-02'), detalle: {
    versionCuenta: 2, saldoPendiente: 5000, subtotalPeriodo: 10000,
    moraCalculadaHasta: '2026-01-31', interesesPendientes: 100, interesesGenerados: 300,
  } });
  assert.equal(deuda.interesesCentavos, 250);
  assert.equal(deuda.interesesGenerados, 450);
  assert.equal(deuda.dias, 60);
});

test('gracia y tope no se reinician despues de un pago', () => {
  const deuda = deudaDePeriodo({ periodo, complejo: { ...complejo, topeMoraPorcentaje: 4 }, hasta: new Date('2026-03-02'), detalle: {
    versionCuenta: 2, saldoPendiente: 10000, subtotalPeriodo: 10000,
    moraCalculadaHasta: '2026-01-31', interesesPendientes: 0, interesesGenerados: 300,
  } });
  assert.equal(deuda.interesesCentavos, 100);
  const antes = deudaDePeriodo({ periodo, complejo: { ...complejo, diasGraciaMora: 10 }, hasta: new Date('2026-01-09'),
    detalle: { saldoPendiente: 10000, moraCalculadaHasta: '2026-01-05' } });
  assert.equal(antes.interesesCentavos, 0);
});
