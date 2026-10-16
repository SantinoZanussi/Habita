import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearPreferencia, leerReferencia, consultarPago } from '../src/externos/mercadopago.js';

test('checkout conserva centavos y genera una preferencia nueva después de un cambio de saldo', async (t) => {
  process.env.MP_ACCESS_TOKEN = 'TEST-ficticio';
  process.env.MP_URL_RETORNO = 'https://habita.example/pago/';
  const peticiones = [];
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    peticiones.push({ url, ...opciones });
    return new Response(JSON.stringify({ id: 'prueba', init_point: 'https://www.mercadopago.com.ar/checkout/prueba' }), { status: 201 });
  });
  const entrada = { referencia: 'c1|u1|2026-10', concepto: 'Expensas' };
  await crearPreferencia({ ...entrada, montoCentavos: 12345 });
  await crearPreferencia({ ...entrada, montoCentavos: 12000 });
  assert.notEqual(peticiones[0].headers['X-Idempotency-Key'], peticiones[1].headers['X-Idempotency-Key']);
  assert.equal(JSON.parse(peticiones[0].body).items[0].unit_price, 123.45);
  assert.equal(JSON.parse(peticiones[1].body).items[0].unit_price, 120);
  assert.equal(JSON.parse(peticiones[0].body).back_urls.success, 'https://habita.example/pago/');
  await assert.rejects(crearPreferencia({ ...entrada, montoCentavos: NaN }));
  assert.equal(peticiones.length, 2);
});

test('referencias ambiguas o rutas inyectadas no se usan para imputar', () => {
  for (const entrada of ['c|u|p|otro', 'c|../u|p', '', 'c||p']) assert.equal(leerReferencia(entrada), null);
  assert.deepEqual(leerReferencia('c1|u1|2026-10'), { complejoId: 'c1', unidadId: 'u1', periodoId: '2026-10' });
});

test('consulta conserva moneda e identificador verificados por el proveedor', async (t) => {
  process.env.MP_ACCESS_TOKEN = 'TEST-ficticio';
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ id: 123, currency_id: 'ARS', transaction_amount: 123.45, status: 'approved' })));
  const pago = await consultarPago('123');
  assert.equal(pago.moneda, 'ARS');
  assert.equal(pago.montoCentavos, 12345);
  assert.equal(pago.id, '123');
});
