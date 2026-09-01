/** Entrada serverless de producción para Firebase Functions v2. */

import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';

process.env.NODE_ENV ??= 'production';
process.env.USAR_EMULADORES ??= 'false';

const mpAccessToken = defineSecret('MP_ACCESS_TOKEN');
const mpSecretoWebhook = defineSecret('MP_SECRETO_WEBHOOK');
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const secretoQr = defineSecret('SECRETO_QR');

setGlobalOptions({
  region: 'southamerica-east1',
  maxInstances: 10,
  concurrency: 40,
});

const { crearApp } = await import('./app.js');

export const api = onRequest({
  timeoutSeconds: 60,
  memory: '512MiB',
  secrets: [mpAccessToken, mpSecretoWebhook, anthropicApiKey, secretoQr],
}, crearApp());
