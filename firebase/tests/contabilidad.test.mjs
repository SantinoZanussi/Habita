import assert from 'node:assert/strict';
import { beforeEach, afterEach, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Estas pruebas requieren el emulador de Firestore.');
process.env.USAR_EMULADORES = 'true';
process.env.FIREBASE_PROJECT_ID = 'demo-habita-cuentas';
const { db, rutas } = await import('../../backend/src/infra/firebase.js');
const { cerrarPeriodo, estadoDeCuenta, resumenCobranza } = await import('../../backend/src/servicios/liquidacion.js');
const { procesarPago } = await import('../../backend/src/servicios/pagos.js');
const { armarReferencia } = await import('../../backend/src/externos/mercadopago.js');
let complejoId;

beforeEach(async () => {
  complejoId = `test-${randomUUID()}`;
  await rutas.complejo(complejoId).set({ tasaMoraMensual: 0 });
  await rutas.unidad(complejoId, 'u1').set({ coeficiente: 100, identificador: '1A', saldoAFavor: 0 });
});
afterEach(async () => db.recursiveDelete(rutas.complejo(complejoId)));
after(async () => db.terminate());

async function periodo(id) {
  await rutas.periodo(complejoId, id).set({
    estado: 'borrador', vencimiento: new Date('2100-12-01'),
    gastosOrdinarios: [{ id: 'g1', montoCentavos: 10000 }],
    fondoReserva: { modo: 'porcentaje', valor: 0 },
  });
}
const cerrar = (periodoId) => cerrarPeriodo({ complejoId, periodoId, adminUid: 'test-admin' });
const cuenta = () => estadoDeCuenta({ complejoId, unidadId: 'u1' });
const pagar = (montoCentavos, pagoId = randomUUID()) => procesarPago({ pagoId, simulado: {
  estado: 'approved', montoCentavos, simulado: true,
  referencia: armarReferencia({ complejoId, unidadId: 'u1', periodoId: '2026-01' }),
} });

test('tres cierres y un pago parcial conservan el capital sin duplicar arrastres', async () => {
  for (const id of ['2026-01', '2026-02', '2026-03']) { await periodo(id); await cerrar(id); }
  assert.equal((await cuenta()).totalAdeudado, 30000);
  await pagar(12000);
  assert.equal((await cuenta()).totalAdeudado, 18000);
  const resumen = await resumenCobranza({ complejoId });
  assert.equal(resumen.saldoPendienteTotal, 18000);
  assert.equal(resumen.serie.reduce((s, p) => s + p.recaudado, 0), 12000);
});

test('dos pagos concurrentes descuentan ambos importes y el reintento no duplica', async () => {
  await periodo('2026-01'); await cerrar('2026-01');
  const id = randomUUID();
  await Promise.all([pagar(3000, id), pagar(4000)]);
  assert.equal((await cuenta()).totalAdeudado, 3000);
  assert.equal((await pagar(3000, id)).idempotente, true);
  assert.equal((await cuenta()).totalAdeudado, 3000);
});

test('un pago concurrente con cierre conserva deuda y aplica excedente al siguiente cargo', async () => {
  await periodo('2026-01'); await cerrar('2026-01');
  await periodo('2026-02');
  await Promise.all([pagar(13000), cerrar('2026-02')]);
  assert.equal((await cuenta()).totalAdeudado, 7000);
  assert.equal((await cuenta()).saldoAFavor, 0);
});

test('saldo a favor se consume una vez y el cierre concurrente no se repite', async () => {
  await periodo('2026-01'); await cerrar('2026-01');
  await pagar(25000);
  assert.equal((await cuenta()).saldoAFavor, 15000);
  await periodo('2026-02');
  const cierres = await Promise.allSettled([cerrar('2026-02'), cerrar('2026-02')]);
  assert.equal(cierres.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await cuenta()).saldoAFavor, 5000);
  assert.equal((await cuenta()).totalAdeudado, 0);
  await periodo('2026-03'); await cerrar('2026-03');
  assert.equal((await cuenta()).totalAdeudado, 5000);
});

test('los saldos legacy con arrastre se bloquean sin reescribir historia', async () => {
  await periodo('2026-01'); await cerrar('2026-01');
  await rutas.detalle(complejoId, '2026-01').doc('u1').update({ versionCuenta: 1, saldoAnterior: 10000 });
  await assert.rejects(pagar(3000), /conciliacion/);
  assert.equal((await rutas.detalle(complejoId, '2026-01').doc('u1').get()).data().saldoPendiente, 10000);
});
