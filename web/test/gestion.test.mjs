import test from 'node:test';
import assert from 'node:assert/strict';
import { reservasFiltradas, destinatariosAviso } from '../src/gestion.js';

test('agenda filtra por estado, espacio y solapamiento del día sin incluir medianoche siguiente', () => {
  const reservas = [
    {id:'noche', amenityId:'sum', estado:'confirmada', desde:'2026-09-15T23:00:00', hasta:'2026-09-16T02:00:00'},
    {id:'otra', amenityId:'pileta', estado:'pendiente', desde:'2026-09-16T12:00:00', hasta:'2026-09-16T14:00:00'},
    {id:'mañana', amenityId:'sum', estado:'confirmada', desde:'2026-09-17T00:00:00', hasta:'2026-09-17T01:00:00'},
  ];
  assert.deepEqual(reservasFiltradas(reservas, {fecha:'2026-09-16', estado:'confirmada', amenity:'sum'}).map(r => r.id), ['noche']);
  assert.equal(reservasFiltradas(reservas).length, 3);
});

test('aviso dirigido requiere destinatarios, elimina duplicados y limita cantidad', () => {
  const datos = new FormData(); datos.set('alcance', 'unidades');
  assert.throws(() => destinatariosAviso(datos), /Elegí/);
  datos.append('unidades','3a'); datos.append('unidades','3a');
  assert.deepEqual(destinatariosAviso(datos), ['3a']);
  for(let i=0;i<30;i++) datos.append('unidades', `u${i}`);
  assert.throws(() => destinatariosAviso(datos), /Elegí/);
  datos.set('alcance','todos');
  assert.equal(destinatariosAviso(datos), 'todos');
});
