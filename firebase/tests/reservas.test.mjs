import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Sólo emulador');
process.env.USAR_EMULADORES = 'true';
process.env.FIREBASE_PROJECT_ID = 'demo-habita-reservas';
const { db, rutas } = await import('../../backend/src/infra/firebase.js');
const { reservarAmenity, cancelarReserva, resolverReserva, guardarAmenity } = await import('../../backend/src/servicios/amenities.js');
const { actualizarUnidad } = await import('../../backend/src/servicios/unidades.js');
let complejoId;
beforeEach(async () => {
  complejoId = `test-${randomUUID()}`;
  await rutas.complejo(complejoId).set({});
  for (const id of ['u1', 'u2']) await rutas.unidad(complejoId, id).set({ habitantes: 4, saldoAFavor: 50 });
  await rutas.amenities(complejoId).doc('sum').set({ nombre: 'SUM', capacidad: 2, requiereAprobacion: true });
});
afterEach(async () => db.recursiveDelete(rutas.complejo(complejoId)));
after(async () => db.terminate());
const reservar = (unidadId = 'u1', asistentes = 2) => reservarAmenity({ complejoId, amenityId: 'sum', unidadId,
  desde: '2100-01-01T13:00:00Z', hasta: '2100-01-01T15:00:00Z', asistentes, actorUid: unidadId });

test('editar un amenity no borra capacidad ni reactiva un espacio dado de baja', async () => {
  await rutas.amenities(complejoId).doc('sum').update({ activo: false });
  const entrada = { complejoId, amenityId: 'sum', actorUid: 'admin' };
  await guardarAmenity({ ...entrada, datos: { nombre: 'Salón' } });
  const amenity = (await rutas.amenities(complejoId).doc('sum').get()).data();
  assert.equal(amenity.capacidad, 2);
  assert.equal(amenity.activo, false);
  await assert.rejects(guardarAmenity({ ...entrada, datos: { capacidad: 'inválido' } }));
});

test('dos usuarios compiten por el último cupo y cancelar lo devuelve', async () => {
  const resultados = await Promise.allSettled([reservar('u1'), reservar('u2')]);
  assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
  const reserva = resultados.find((r) => r.status === 'fulfilled').value;
  await cancelarReserva({ complejoId, reservaId: reserva.id, actorUid: 'admin' });
  const nueva = await reservar('u2');
  assert.equal(nueva.disponibles, 0);
});

test('aprobar en paralelo con cancelar nunca revive una reserva cancelada', async () => {
  const reserva = await reservar();
  await Promise.allSettled([
    cancelarReserva({ complejoId, reservaId: reserva.id, actorUid: 'u1', unidadId: 'u1' }),
    resolverReserva({ complejoId, reservaId: reserva.id, actorUid: 'admin', estado: 'confirmada' }),
  ]);
  assert.equal((await rutas.reservas(complejoId).doc(reserva.id).get()).data().estado, 'cancelada');
  assert.equal((await reservar('u2')).disponibles, 0);
});

test('no reserva unidad inexistente ni cancela reservas de un vecino', async () => {
  await assert.rejects(reservar('inexistente'), /unidad/i);
  const reserva = await reservar();
  await assert.rejects(cancelarReserva({ complejoId, reservaId: reserva.id, actorUid: 'u2', unidadId: 'u2' }), /tu unidad/);
});

test('el ABM de unidades no permite modificar saldos ni auditoría', async () => {
  await actualizarUnidad({ complejoId, unidadId: 'u1', actorUid: 'admin', cambios: { habitantes: 3, saldoAFavor: 900000, creadoPorUid: 'falso' } });
  const unidad = (await rutas.unidad(complejoId, 'u1').get()).data();
  assert.equal(unidad.habitantes, 3);
  assert.equal(unidad.saldoAFavor, 50);
  assert.equal(unidad.creadoPorUid, undefined);
});
