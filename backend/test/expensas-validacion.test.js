import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizarPeriodo } from '../src/rutas/expensas.js';

test('rechaza datos contables inválidos antes de guardar un borrador', () => {
  for (const datos of [
    { vencimiento: 'nunca' }, { fondoReserva: { modo: 'monto', valor: -50 } },
    { fondoReserva: { modo: 'porcentaje', valor: 200 } },
    { gastosOrdinarios: [{ concepto: ' ', monto: 10 }] },
    { gastosOrdinarios: [{ concepto: 'Luz', monto: Infinity }] },
    { gastosOrdinarios: [{ concepto: 'Luz', monto: 10, criterio: 'inventado' }] },
  ]) assert.throws(() => normalizarPeriodo(datos), { codigo: 'DATOS_INVALIDOS' });
  const valido = normalizarPeriodo({ vencimiento: '2026-10-20', gastosOrdinarios: [{ concepto: 'Luz', monto: 123.45 }] });
  assert.equal(valido.gastosOrdinarios[0].montoCentavos, 12345);
});
