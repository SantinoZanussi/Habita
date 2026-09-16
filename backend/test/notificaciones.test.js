import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.USAR_EMULADORES = 'true';
const { normalizarAviso, tokensDestinatarios } = await import('../src/servicios/notificaciones.js');

test('avisos para dos unidades no incluyen a la tercera ni a usuarios inactivos', () => {
  const usuarios = ['u1', 'u2', 'u3'].map((unidadId) => ({ unidadId, activo: true, tokenFcm: unidadId }));
  usuarios.push({ unidadId: 'u1', activo: false, tokenFcm: 'inactivo' });
  assert.deepEqual(tokensDestinatarios(usuarios, ['u1', 'u2']), ['u1', 'u2']);
  assert.deepEqual(tokensDestinatarios(usuarios, ['u1']), ['u1']);
  assert.deepEqual(tokensDestinatarios(usuarios, 'todos'), ['u1', 'u2', 'u3']);
});

test('los avisos validan texto y destinatarios antes de escribir', () => {
  for (const destinatarios of [[], [''], ['u/1'], 3, 'u1', null]) {
    assert.throws(() => normalizarAviso({ titulo: 'Hola', cuerpo: 'Mensaje', destinatarios }));
  }
  assert.throws(() => normalizarAviso({ titulo: '', cuerpo: 'Mensaje' }));
  assert.deepEqual(normalizarAviso({ titulo: ' Hola ', cuerpo: ' Mensaje ', destinatarios: ['u1', 'u1'] }), {
    titulo: 'Hola', cuerpo: 'Mensaje', destinatarios: ['u1'],
  });
});
