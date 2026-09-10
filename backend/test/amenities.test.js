import assert from 'node:assert/strict';
import test from 'node:test';

import { reservasSuperpuestas, validarIntervaloReserva } from '../src/servicios/amenities.js';

test('el intervalo de reserva exige fechas válidas, ordenadas y asistentes positivos', () => {
  const resultado = validarIntervaloReserva({
    desde: '2026-09-11T10:00:00.000Z',
    hasta: '2026-09-11T12:00:00.000Z',
    asistentes: '2',
  });
  assert.equal(resultado.cantidad, 2);
  assert.equal(resultado.inicio.toISOString(), '2026-09-11T10:00:00.000Z');
  assert.throws(
    () => validarIntervaloReserva({ desde: 'no-fecha', hasta: '2026-09-11T12:00:00Z' }),
    { codigo: 'DATOS_INVALIDOS' },
  );
  assert.throws(
    () => validarIntervaloReserva({ desde: '2026-09-11T12:00:00Z', hasta: '2026-09-11T10:00:00Z' }),
    { codigo: 'DATOS_INVALIDOS' },
  );
  assert.throws(
    () => validarIntervaloReserva({ desde: '2026-09-11T10:00:00Z', hasta: '2026-09-11T12:00:00Z', asistentes: 0 }),
    { codigo: 'DATOS_INVALIDOS' },
  );
});

test('las reservas superpuestas incluyen pendientes y excluyen canceladas o de otro horario', () => {
  const inicio = new Date('2026-09-11T10:00:00Z');
  const fin = new Date('2026-09-11T12:00:00Z');
  const reservas = [
    { id: 'confirmada', estado: 'confirmada', desde: '2026-09-11T11:00:00Z', hasta: '2026-09-11T13:00:00Z' },
    { id: 'pendiente', estado: 'pendiente', desde: '2026-09-11T09:00:00Z', hasta: '2026-09-11T10:30:00Z' },
    { id: 'cancelada', estado: 'cancelada', desde: '2026-09-11T10:30:00Z', hasta: '2026-09-11T11:00:00Z' },
    { id: 'lejana', estado: 'confirmada', desde: '2026-09-11T13:00:00Z', hasta: '2026-09-11T14:00:00Z' },
  ];
  assert.deepEqual(reservasSuperpuestas(reservas, inicio, fin).map((r) => r.id), ['confirmada', 'pendiente']);
});
