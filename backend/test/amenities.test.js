import assert from 'node:assert/strict';
import test from 'node:test';

import { reservasSuperpuestas, validarIntervaloReserva, validarHorarioAmenity } from '../src/servicios/amenities.js';

test('horarios del complejo, pasado y anticipación se validan en el servidor', () => {
  const amenity = { horarios: [{ desde: '08:00', hasta: '23:00' }], anticipacionMaximaDias: 30 };
  const ahora = new Date('2026-10-16T12:00:00Z');
  const validar = (inicio, fin) => validarHorarioAmenity(amenity, new Date(inicio), new Date(fin), ahora);
  assert.doesNotThrow(() => validar('2026-10-17T11:00:00Z', '2026-10-17T13:00:00Z'));
  assert.throws(() => validar('2026-10-17T09:00:00Z', '2026-10-17T13:00:00Z'), /datos/i);
  assert.throws(() => validar('2026-10-15T13:00:00Z', '2026-10-15T15:00:00Z'), /datos/i);
  assert.throws(() => validar('2026-12-20T13:00:00Z', '2026-12-20T15:00:00Z'), /datos/i);
  assert.throws(() => validarIntervaloReserva({ desde: null, hasta: '2026-10-17T13:00:00Z' }), /datos/i);
  const nocturno = { horarios: [{ desde: '22:00', hasta: '02:00' }] };
  assert.doesNotThrow(() => validarHorarioAmenity(nocturno, new Date('2026-10-17T02:00:00Z'), new Date('2026-10-17T04:00:00Z'), ahora));
  assert.throws(() => validarHorarioAmenity(nocturno, new Date('2026-10-17T02:00:00Z'), new Date('2026-10-17T06:00:00Z'), ahora));
});

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
