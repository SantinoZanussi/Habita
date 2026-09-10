import assert from 'node:assert/strict';
import { afterEach, test, mock } from 'node:test';

// Todas las operaciones externas se reemplazan con dobles; nunca usa cuentas reales.
process.env.USAR_EMULADORES = 'true';
const { auth, rutas } = await import('../src/infra/firebase.js');
const { asignarRol, crearUsuario } = await import('../src/servicios/usuarios.js');

const admin = { uid: 'admin-c1', rol: 'admin_complejo', complejoId: 'c1' };
const cartera = { uid: 'super-c1', rol: 'superadmin', complejos: ['c1'] };
const destino = { uid: 'objetivo', rol: 'residente', complejoId: 'c1', unidadId: 'u1' };

afterEach(() => mock.restoreAll());

function preparar(actual) {
  const llamadas = [];
  mock.method(auth, 'getUser', async (uid) => ({ uid, customClaims: actual }));
  mock.method(auth, 'setCustomUserClaims', async (uid, claims) => llamadas.push({ operacion: 'claims', uid, claims }));
  mock.method(auth, 'revokeRefreshTokens', async (uid) => llamadas.push({ operacion: 'revocar', uid }));
  mock.method(rutas, 'usuario', (uid) => ({ set: async (datos) => llamadas.push({ operacion: 'perfil', uid, datos }) }));
  return llamadas;
}

test('admin no traslada a su complejo un UID ajeno aunque el destino sea válido', async () => {
  const llamadas = preparar({ rol: 'residente', complejoId: 'c2', unidadId: 'u2' });
  await assert.rejects(asignarRol(destino, admin), { codigo: 'SIN_PERMISO' });
  assert.deepEqual(llamadas, []);
});

test('admin no degrada a otro administrador ni a un superadmin para capturar su cuenta', async () => {
  for (const actual of [{ rol: 'admin_complejo', complejoId: 'c1' }, { rol: 'superadmin', complejos: ['c1'] }]) {
    const llamadas = preparar(actual);
    await assert.rejects(asignarRol(destino, admin), { codigo: 'SIN_PERMISO' });
    assert.deepEqual(llamadas, []);
    mock.restoreAll();
  }
});

test('admin cambia un usuario operativo propio y revoca sus sesiones anteriores', async () => {
  const llamadas = preparar({ rol: 'residente', complejoId: 'c1', unidadId: 'u1' });
  const resultado = await asignarRol({ uid: 'objetivo', rol: 'guardia', complejoId: 'c1' }, admin);
  assert.equal(resultado.rol, 'guardia');
  assert.deepEqual(llamadas.map((l) => l.operacion), ['claims', 'perfil', 'revocar']);
  assert.deepEqual(llamadas[0].claims, { rol: 'guardia', complejoId: 'c1' });
});

test('superadmin no amplía una cartera fuera de su alcance mediante creación o asignación', async () => {
  const llamadas = preparar({ rol: 'residente', complejoId: 'c1' });
  const datos = { uid: 'objetivo', rol: 'superadmin', complejos: ['c1', 'c2'] };
  await assert.rejects(asignarRol(datos, cartera), { codigo: 'SIN_PERMISO' });
  await assert.rejects(crearUsuario(datos, cartera), { codigo: 'SIN_PERMISO' });
  assert.deepEqual(llamadas, []);
});

test('superadmin no reasigna un usuario ni una cartera ajenos', async () => {
  for (const actual of [{ rol: 'residente', complejoId: 'c2' }, { rol: 'superadmin', complejos: ['c1', 'c2'] }]) {
    const llamadas = preparar(actual);
    await assert.rejects(asignarRol(destino, cartera), { codigo: 'SIN_PERMISO' });
    assert.deepEqual(llamadas, []);
    mock.restoreAll();
  }
});

test('crear o modificar roles requiere un actor administrativo explícito', async () => {
  preparar({ rol: 'residente', complejoId: 'c1' });
  await assert.rejects(asignarRol(destino), { codigo: 'SIN_PERMISO' });
  await assert.rejects(crearUsuario(destino, { rol: 'residente', complejoId: 'c1' }), { codigo: 'SIN_PERMISO' });
});
