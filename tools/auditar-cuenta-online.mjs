// Auditoría de solo lectura del esquema contable de la unidad demo.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cli = require('firebase-tools/lib/auth');
const proyecto = 'habita-complejos-goiburu';
const complejoId = 'torre-parque';
const unidadId = 'unidad-3a';
const cuenta = cli.getProjectDefaultAccount(process.cwd());
if (!cuenta) throw new Error('Conectar primero Firebase CLI.');
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('No mezclar la auditoría online y emuladores.');
}

const token = await cli.getAccessToken(cuenta.tokens.refresh_token, [
  'https://www.googleapis.com/auth/firebase',
  'https://www.googleapis.com/auth/cloud-platform',
]);
const base = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents`;
const headers = { Authorization: `Bearer ${token.access_token}` };

async function listar(path) {
  const respuesta = await fetch(`${base}/${path}?pageSize=100`, { headers });
  if (!respuesta.ok) throw new Error(`Firestore lectura ${path}: HTTP ${respuesta.status}`);
  return (await respuesta.json()).documents ?? [];
}

async function documento(path) {
  const respuesta = await fetch(`${base}/${path}`, { headers });
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(`Firestore lectura ${path}: HTTP ${respuesta.status}`);
  return respuesta.json();
}

function primitivo(campo) {
  if (!campo) return null;
  if ('integerValue' in campo) return Number(campo.integerValue);
  if ('doubleValue' in campo) return campo.doubleValue;
  if ('booleanValue' in campo) return campo.booleanValue;
  if ('stringValue' in campo) return campo.stringValue;
  if ('timestampValue' in campo) return campo.timestampValue;
  return '[complejo]';
}

const periodos = await listar(`complejos/${complejoId}/periodos`);
const filas = [];
for (const periodo of periodos) {
  const periodoId = periodo.name.split('/').at(-1);
  const detalle = await documento(`complejos/${complejoId}/periodos/${periodoId}/detalle/${unidadId}`);
  if (!detalle) continue;
  const f = detalle.fields ?? {};
  filas.push({
    periodoId,
    estado: primitivo(periodo.fields?.estado),
    versionCuenta: primitivo(f.versionCuenta),
    subtotalPeriodo: primitivo(f.subtotalPeriodo),
    saldoAnterior: primitivo(f.saldoAnterior),
    interesesMora: primitivo(f.interesesMora),
    saldoPendiente: primitivo(f.saldoPendiente),
    interesesPendientes: primitivo(f.interesesPendientes),
    interesesGenerados: primitivo(f.interesesGenerados),
    pagado: primitivo(f.pagado),
  });
}

console.table(filas.sort((a, b) => a.periodoId.localeCompare(b.periodoId)));
console.log(`Auditoría de solo lectura: ${filas.length} liquidaciones, sin datos personales ni escrituras.`);
