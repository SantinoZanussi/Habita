import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const cli = require('firebase-tools/lib/auth');
const cuenta = cli.getProjectDefaultAccount(process.cwd());
const config = JSON.parse(readFileSync(new URL('../mobile/firebase.production.json', import.meta.url)));
const proyecto = 'habita-complejos-goiburu';
if (!cuenta || config.FIREBASE_PROJECT_ID !== proyecto) throw new Error('Revisar sesion y proyecto.');
const password = process.env.HABITA_DEMO_PASSWORD;
if (!password) throw new Error('Falta HABITA_DEMO_PASSWORD.');
const login = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.FIREBASE_API_KEY}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'residente@habita.demo', password, returnSecureToken: true }),
});
const sesion = await login.json();
if (!login.ok) throw new Error('No se pudo autenticar al residente demo.');
const raiz = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)`;
async function consultar() {
  const r = await fetch(`${raiz}/documents/complejos/torre-parque:runQuery`, {
    method: 'POST', headers: { Authorization: `Bearer ${sesion.idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'notificaciones' }],
      where: { compositeFilter: { op: 'OR', filters: [
        { fieldFilter: { field: { fieldPath: 'destinatarios' }, op: 'EQUAL', value: { stringValue: 'todos' } } },
        { fieldFilter: { field: { fieldPath: 'destinatarios' }, op: 'ARRAY_CONTAINS', value: { stringValue: 'unidad-3a' } } },
      ] } },
      orderBy: [{ field: { fieldPath: 'enviadaEn' }, direction: 'DESCENDING' }], limit: 3,
    } }),
  });
  const data = await r.json();
  const error = data.error ?? data.find?.(x => x.error)?.error;
  if (!r.ok || error) {
    console.log(`Consulta residente: ${error?.status ?? r.status}`);
    return false;
  }
  console.log(`OK consulta residente: ${data.filter(x => x.document).length} novedades.`);
  return true;
}
if (await consultar()) process.exit(0);
if (!process.argv.includes('--corregir')) process.exit(1);
const token = await cli.getAccessToken(cuenta.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' };
const endpoint = `${raiz}/collectionGroups/notificaciones/indexes`;
const deseados = JSON.parse(readFileSync(new URL('../firebase/firestore.indexes.json', import.meta.url))).indexes
  .filter(i => i.collectionGroup === 'notificaciones' && i.fields.some(f => f.fieldPath === 'destinatarios'));
for (const { queryScope, fields } of deseados) {
  const r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ queryScope, fields }) });
  if (!r.ok && r.status !== 409) throw new Error(`Alta indice: HTTP ${r.status}`);
  console.log(r.status === 409 ? 'Indice ya existente.' : 'Indice solicitado.');
}
for (let n = 0; n < 30; n++) {
  await new Promise(resolve => setTimeout(resolve, 10000));
  if (await consultar()) process.exit(0);
}
throw new Error('Indices aun no disponibles; volver a comprobar mas tarde.');
