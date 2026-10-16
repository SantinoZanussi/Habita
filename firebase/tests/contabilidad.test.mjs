import assert from 'node:assert/strict';
import { beforeEach, afterEach, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Estas pruebas requieren el emulador de Firestore.');
process.env.USAR_EMULADORES = 'true';
process.env.FIREBASE_PROJECT_ID = 'demo-habita-cuentas';
const { db, rutas } = await import('../../backend/src/infra/firebase.js');
const { cerrarPeriodo, estadoDeCuenta, resumenCobranza } = await import('../../backend/src/servicios/liquidacion.js');
const { procesarPago, generarLinkDePago, registrarPagoManual } = await import('../../backend/src/servicios/pagos.js');
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

test('checkout incluye deuda anterior a 12 meses y el saldo total luego de pagos parciales', async () => {
  process.env.MP_ACCESS_TOKEN = '';
  for (let i = 1; i <= 13; i++) {
    const id = `periodo-${String(i).padStart(2, '0')}`;
    await periodo(id); await cerrar(id);
    if (i > 1) await rutas.detalle(complejoId, id).doc('u1').update({ saldoPendiente: 0, pagado: true });
  }
  const actual = await cuenta();
  assert.equal(actual.liquidaciones.length, 13);
  assert.equal(actual.proximoVencimiento.periodoId, 'periodo-01');
  const link = await generarLinkDePago({ complejoId, unidadId: 'u1' });
  assert.equal(link.montoCentavos, 10000);
  await rutas.detalle(complejoId, 'periodo-01').doc('u1').update({ saldoPendiente: 2500 });
  assert.equal((await generarLinkDePago({ complejoId, unidadId: 'u1' })).montoCentavos, 2500);
});

test('el checkout de cuenta cobra todos los periodos y el explícito sólo su saldo', async () => {
  process.env.MP_ACCESS_TOKEN = '';
  await periodo('2026-01'); await cerrar('2026-01');
  await periodo('2026-02'); await cerrar('2026-02');
  await pagar(3000);
  assert.equal((await generarLinkDePago({ complejoId, unidadId: 'u1' })).montoCentavos, 17000);
  assert.equal((await generarLinkDePago({ complejoId, unidadId: 'u1', periodoId: '2026-02' })).montoCentavos, 10000);
});

test('reintentos manuales acreditan una vez y rechazan cambiar datos con la misma clave', async () => {
  await periodo('2026-01'); await cerrar('2026-01');
  const entrada = { complejoId, unidadId: 'u1', periodoId: '2026-01', montoCentavos: 3000,
    adminUid: 'admin', observacion: 'Prueba', idempotencyKey: randomUUID() };
  await Promise.all([registrarPagoManual(entrada), registrarPagoManual(entrada)]);
  assert.equal((await cuenta()).totalAdeudado, 7000);
  await assert.rejects(registrarPagoManual({ ...entrada, montoCentavos: 5000 }), /otros datos/);
  await assert.rejects(registrarPagoManual({ ...entrada, idempotencyKey: randomUUID(), periodoId: 'inexistente' }), /liquidación cerrada/);
  assert.equal((await rutas.pagos(complejoId).get()).size, 1);
});

test('cobranza y residente coinciden en mora luego de un pago parcial', async () => {
  await rutas.complejo(complejoId).update({ tasaMoraMensual: 3 });
  await periodo('2026-01'); await cerrar('2026-01');
  await rutas.periodo(complejoId, '2026-01').update({ vencimiento: new Date(Date.now() - 60 * 86400000) });
  await pagar(3000);
  const actual = await cuenta();
  const resumen = await resumenCobranza({ complejoId });
  assert.equal(resumen.totalAdeudado, actual.totalAdeudado);
  assert.equal(resumen.morosidadTotal, actual.totalAdeudado);
});

test('HTTP no sobrescribe períodos duplicados ni permite editar después del cierre', async (t) => {
  const { once } = await import('node:events');
  const { crearApp } = await import('../../backend/src/app.js');
  const { auth } = await import('../../backend/src/infra/firebase.js');
  t.mock.method(auth, 'verifyIdToken', async () => ({ uid: 'admin', rol: 'admin_complejo', complejoId }));
  const servidor = crearApp().listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(() => new Promise((resolve) => { servidor.close(resolve); servidor.closeAllConnections(); }));
  const base = `http://127.0.0.1:${servidor.address().port}/api/complejos/${complejoId}/expensas/periodos`;
  const enviar = (method, path, body) => fetch(base + path, { method, body: JSON.stringify(body),
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' } });
  const datos = { periodoId: '2026-01', vencimiento: '2100-12-01', gastosOrdinarios: [{ concepto: 'Luz', monto: 100 }] };
  const creados = await Promise.all([enviar('POST', '', datos), enviar('POST', '', datos)]);
  assert.deepEqual(creados.map((r) => r.status).sort(), [201, 409]);
  await cerrar('2026-01');
  assert.equal((await enviar('PATCH', '/2026-01', { gastosOrdinarios: [{ concepto: 'Otro', monto: 200 }] })).status, 409);
  assert.equal((await cuenta()).totalAdeudado, 10000);
});

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

test('dos notificaciones simultaneas del mismo pago acreditan una sola vez', async () => {
  await periodo('2026-01'); await cerrar('2026-01');
  const id = randomUUID();
  const resultados = await Promise.all([pagar(3000, id), pagar(3000, id)]);
  assert.equal(resultados.filter((r) => r.procesado).length, 1);
  assert.equal(resultados.filter((r) => r.idempotente).length, 1);
  assert.equal((await cuenta()).totalAdeudado, 7000);
  assert.equal((await rutas.pagos(complejoId).get()).size, 1);
  assert.equal((await pagar(3000, id)).idempotente, true);
  assert.equal((await cuenta()).totalAdeudado, 7000);
  const resumen = await resumenCobranza({ complejoId });
  assert.equal(resumen.serie.reduce((s, p) => s + p.recaudado, 0), 3000);
});

test('pagos rechazados, pendientes y cancelados no modifican deuda ni cobranza', async () => {
  await periodo('2026-01'); await cerrar('2026-01');
  const revisionInicial = (await rutas.complejo(complejoId).get()).data().revisionCuenta;
  for (const estado of ['rejected', 'pending', 'cancelled']) {
    const resultado = await procesarPago({ pagoId: randomUUID(), simulado: {
      estado, montoCentavos: 3000, simulado: true,
      referencia: armarReferencia({ complejoId, unidadId: 'u1', periodoId: '2026-01' }),
    } });
    assert.equal(resultado.procesado, false, estado);
    assert.equal(resultado.motivo, `estado_${estado}`);
    assert.equal((await cuenta()).totalAdeudado, 10000, estado);
  }
  assert.equal((await rutas.pagos(complejoId).get()).size, 0);
  assert.equal((await rutas.complejo(complejoId).get()).data().revisionCuenta, revisionInicial);
  const resumen = await resumenCobranza({ complejoId });
  assert.equal(resumen.serie.reduce((s, p) => s + p.recaudado, 0), 0);
});

test('un pago pendiente puede aprobarse despues y sus reintentos no lo duplican', async () => {
  await periodo('2026-01'); await cerrar('2026-01');
  const id = randomUUID();
  await procesarPago({ pagoId: id, simulado: {
    estado: 'pending', montoCentavos: 3000, simulado: true,
    referencia: armarReferencia({ complejoId, unidadId: 'u1', periodoId: '2026-01' }),
  } });
  assert.equal((await cuenta()).totalAdeudado, 10000);
  assert.equal((await pagar(3000, id)).procesado, true);
  assert.equal((await pagar(3000, id)).idempotente, true);
  assert.equal((await cuenta()).totalAdeudado, 7000);
  assert.equal((await rutas.pagos(complejoId).get()).size, 1);
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
