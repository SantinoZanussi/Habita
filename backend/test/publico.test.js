import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

process.env.USAR_EMULADORES = 'true';
process.env.FIREBASE_PROJECT_ID = 'habita-demo';

test('el contacto público valida, limita tamaños y conserva el tipo de complejo', async (t) => {
  const { crearApp } = await import('../src/app.js');
  const { rutas } = await import('../src/infra/firebase.js');
  let guardado;
  t.mock.method(rutas, 'contactos', () => ({
    doc: () => ({
      id: 'contacto-demo',
      set: async (datos) => { guardado = datos; },
    }),
  }));

  const servidor = crearApp().listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(() => new Promise((resolve) => {
    servidor.close(resolve);
    servidor.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${servidor.address().port}/api/contacto`;
  async function post(cuerpo) {
    return fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  }

  const invalido = await post({ nombre: 'A', email: 'no-es-correo', mensaje: 'corto' });
  assert.equal(invalido.status, 422);

  const valido = await post({
    nombre: 'María González',
    email: 'maria@example.com',
    tipo: 'Barrio cerrado',
    mensaje: 'Queremos ordenar los accesos y las expensas del complejo.',
  });
  assert.equal(valido.status, 201);
  assert.equal(guardado.nombre, 'María González');
  assert.equal(guardado.email, 'maria@example.com');
  assert.equal(guardado.tipo, 'Barrio cerrado');
  assert.equal(guardado.estado, 'nuevo');
});
