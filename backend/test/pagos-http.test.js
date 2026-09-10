import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

test('las rutas HTTP separan simulación, sesión, complejo y webhook externo', async (t) => {
  // Esta prueba no usa Firebase ni Mercado Pago reales. La validación
  // criptográfica del token pertenece al SDK; aquí probamos la autorización.
  process.env.USAR_EMULADORES = 'true';
  process.env.FIREBASE_PROJECT_ID = 'habita-demo';
  process.env.MP_ACCESS_TOKEN = '';
  process.env.MP_SECRETO_WEBHOOK = 'firma-ficticia-solo-test';
  const { crearApp } = await import('../src/app.js');
  const { auth, db } = await import('../src/infra/firebase.js');
  t.mock.method(auth, 'verifyIdToken', async (token) => ({
    uid: 'residente-test', rol: token === 'guardia-test' ? 'guardia' : 'residente',
    complejoId: 'demo-test', unidadId: 'unidad-test',
  }));
  t.mock.method(db, 'collection', () => { throw new Error('Estos rechazos no deben acceder a Firestore'); });

  const servidor = crearApp().listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(() => new Promise((resolve) => {
    servidor.close(resolve);
    servidor.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${servidor.address().port}/api`;
  async function post(ruta, token) {
    return fetch(`${base}${ruta}`, {
      method: 'POST', body: '{}', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }

  assert.equal((await post('/complejos/demo-test/expensas/pagos/simular')).status, 401);
  assert.equal((await post('/complejos/demo-test/expensas/pagos/simular', 'guardia-test')).status, 403);
  assert.equal((await post('/complejos/ajeno/expensas/pagos/simular', 'residente-test')).status, 403);
  assert.equal((await post('/webhooks/mercadopago')).status, 503);

  process.env.MP_ACCESS_TOKEN = 'TEST-no-es-una-credencial';
  const simulacion = await post('/complejos/demo-test/expensas/pagos/simular', 'residente-test');
  assert.equal(simulacion.status, 403);
  assert.match((await simulacion.json()).error.mensaje, /simulados están deshabilitados/);
  assert.equal((await post('/webhooks/mercadopago')).status, 403);
});
