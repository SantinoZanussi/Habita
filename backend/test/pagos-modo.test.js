import assert from 'node:assert/strict';
import test from 'node:test';
import { exigirPagoSimulado, exigirMercadoPagoActivo } from '../src/middleware/pagos.js';

function comprobar(middleware) {
  const llamadas = [];
  middleware({}, {}, (error) => llamadas.push(error));
  assert.equal(llamadas.length, 1);
  return llamadas[0];
}

test('sin credenciales permite la demo autenticada y rechaza el webhook externo', (t) => {
  const anterior = process.env.MP_ACCESS_TOKEN;
  t.after(() => {
    if (anterior === undefined) delete process.env.MP_ACCESS_TOKEN;
    else process.env.MP_ACCESS_TOKEN = anterior;
  });
  for (const token of ['', '   ']) {
    process.env.MP_ACCESS_TOKEN = token;
    assert.equal(comprobar(exigirPagoSimulado), undefined);
    const error = comprobar(exigirMercadoPagoActivo);
    assert.equal(error.estado, 503);
    assert.equal(error.codigo, 'SERVICIO_EXTERNO_CAIDO');
  }
});

test('con credenciales, incluso de prueba, no se pueden acreditar pagos simulados', (t) => {
  const anterior = process.env.MP_ACCESS_TOKEN;
  t.after(() => {
    if (anterior === undefined) delete process.env.MP_ACCESS_TOKEN;
    else process.env.MP_ACCESS_TOKEN = anterior;
  });
  for (const token of ['TEST-token-ficticio', 'APP_USR-token-ficticio']) {
    process.env.MP_ACCESS_TOKEN = token;
    assert.equal(comprobar(exigirPagoSimulado).estado, 403);
    assert.equal(comprobar(exigirMercadoPagoActivo), undefined);
  }
});
