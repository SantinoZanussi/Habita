import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { verificarFirmaWebhook } from '../src/externos/mercadopago.js';

const secreto = 'secreto-webhook-de-prueba';

function firmar({ dataId, requestId, ts }) {
  const manifiesto = [
    dataId ? `id:${dataId.toLowerCase()};` : '',
    requestId ? `request-id:${requestId};` : '',
    `ts:${ts};`,
  ].join('');
  return createHmac('sha256', secreto).update(manifiesto).digest('hex');
}

test('valida la firma actual de Mercado Pago y normaliza data.id', () => {
  process.env.MP_ACCESS_TOKEN = 'token-prueba';
  process.env.MP_SECRETO_WEBHOOK = secreto;
  const ts = Math.floor(Date.now() / 1000);
  const dataId = 'ABC123';
  const requestId = 'request-1';
  const v1 = firmar({ dataId, requestId, ts });

  const resultado = verificarFirmaWebhook({
    firma: `ts=${ts},v1=${v1}`,
    requestId,
    dataId,
  });
  assert.equal(resultado.valido, true);
});

test('acepta timestamp en milisegundos y omite campos ausentes', () => {
  process.env.MP_ACCESS_TOKEN = 'token-prueba';
  process.env.MP_SECRETO_WEBHOOK = secreto;
  const ts = Date.now();
  const dataId = '123456';
  const v1 = firmar({ dataId, requestId: null, ts });

  assert.equal(verificarFirmaWebhook({
    firma: `ts=${ts},v1=${v1}`,
    requestId: null,
    dataId,
  }).valido, true);
});

test('rechaza firmas vencidas o manipuladas', () => {
  process.env.MP_ACCESS_TOKEN = 'token-prueba';
  process.env.MP_SECRETO_WEBHOOK = secreto;
  const ts = Math.floor(Date.now() / 1000) - 600;
  const dataId = '123456';
  const requestId = 'request-2';
  const v1 = firmar({ dataId, requestId, ts });

  assert.equal(verificarFirmaWebhook({
    firma: `ts=${ts},v1=${v1}`,
    requestId,
    dataId,
  }).valido, false);
  assert.equal(verificarFirmaWebhook({
    firma: `ts=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`,
    requestId,
    dataId,
  }).valido, false);
});
