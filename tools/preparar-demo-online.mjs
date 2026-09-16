// Alta acotada y no destructiva: nunca ejecuta el seed de emuladores.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const require = createRequire(import.meta.url);
const cli = require('firebase-tools/lib/auth');
const proyecto = 'habita-complejos-goiburu';
const complejoId = 'torre-parque';
const aplicar = process.argv.includes('--aplicar');
const soloAdmin = process.argv.includes('--solo-admin');
const cuenta = cli.getProjectDefaultAccount(process.cwd());
if (!cuenta) throw new Error('Conectar primero Firebase CLI.');
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('No mezclar configuracion online y emuladores.');
}
const obtenerToken = () => cli.getAccessToken(cuenta.tokens.refresh_token, [
  'https://www.googleapis.com/auth/firebase',
  'https://www.googleapis.com/auth/cloud-platform',
]);
const auth = getAuth(initializeApp({
  projectId: proyecto,
  credential: { getAccessToken: async () => {
    const token = await obtenerToken();
    return { access_token: token.access_token, expires_in: 3600 };
  } },
}));
const base = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents`;
const usuarios = soloAdmin ? [
  { email: 'admin@habita.demo', nombre: 'Juan Perez', claims: { rol: 'admin_complejo', complejoId } },
] : [
  { email: 'residente@habita.demo', nombre: 'Juan Perez', claims: { rol: 'residente', complejoId, unidadId: 'unidad-3a' } },
  { email: 'guardia@habita.demo', nombre: 'Marcos Guardia', claims: { rol: 'guardia', complejoId } },
];

async function documento(path) {
  const token = await obtenerToken();
  const r = await fetch(`${base}/${path}`, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore lectura: HTTP ${r.status}`);
  return r.json();
}

function valor(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, valor(x)])) } };
}

const complejo = await documento(`complejos/${complejoId}`);
if (soloAdmin && !complejo) throw new Error('Crear primero el complejo demo.');
if (complejo && complejo.fields?.demo?.booleanValue !== true) {
  throw new Error('El complejo ya existe y no esta marcado como demo. Revisar manualmente.');
}
for (const u of usuarios) {
  u.registro = await auth.getUserByEmail(u.email).catch(e => {
    if (e.code === 'auth/user-not-found') return null;
    throw e;
  });
  const claims = u.registro?.customClaims ?? {};
  if (Object.entries(claims).some(([k, v]) => u.claims[k] !== v)) {
    throw new Error(`Permisos existentes distintos para ${u.claims.rol}; no se modifican.`);
  }
}
console.log(`Destino ${proyecto}: ${soloAdmin ? 'administrador del complejo demo' : 'dos perfiles demo y datos basicos'}, sin movimientos financieros.`);
if (!aplicar) {
  console.log('Vista previa. Usar --aplicar con HABITA_DEMO_PASSWORD para confirmar.');
  process.exit(0);
}
const password = process.env.HABITA_DEMO_PASSWORD;
if (!password) throw new Error('Falta HABITA_DEMO_PASSWORD; no se guarda en archivos.');

for (const u of usuarios) {
  if (!u.registro) u.registro = await auth.createUser({ email: u.email, password, displayName: u.nombre });
}
const ahora = new Date().toISOString();
const datos = [
  ...(soloAdmin ? [] : [
  [`complejos/${complejoId}`, {
    nombre: 'Torre del Parque', demo: true, activo: true,
    tipo: 'edificio', tipoUnidad: 'departamento', nomenclaturaAporte: 'expensa',
    metodosAcceso: ['qr', 'nfc', 'patente'], zonaHoraria: 'America/Argentina/Buenos_Aires',
    modulosActivos: { obras: false, evaluacion: true, consumos: true },
    puntosAcceso: [{ id: 'torre-principal', nombre: 'Torre - Entrada principal' }],
  }],
  [`complejos/${complejoId}/unidades/unidad-3a`, {
    demo: true, identificador: '3A', identificadorNormalizado: '3A',
    titularUid: usuarios[0].registro.uid, inquilinoUid: null,
    coeficiente: 100, superficie: 65, estado: 'ocupada', patentesAutorizadas: [], saldoAFavor: 0,
  }],
  ]),
  ...usuarios.map(u => [`usuarios/${u.registro.uid}`, {
    nombre: u.nombre, email: u.email, ...u.claims, activo: true, demo: true,
    unidadId: u.claims.unidadId ?? null, complejos: [], obraIds: [],
  }]),
];
const writes = [];
for (const [path, data] of datos) {
  const existente = await documento(path);
  if (existente) {
    if (existente.fields?.demo?.booleanValue !== true) throw new Error(`Documento no demo: ${path}`);
    if (data.titularUid && existente.fields?.titularUid?.stringValue !== data.titularUid) {
      throw new Error('La unidad pertenece a otra cuenta. No se reasigna.');
    }
    continue;
  }
  writes.push({
    update: { name: `${base.replace('https://firestore.googleapis.com/v1/', '')}/${path}`,
      fields: { ...valor(data).mapValue.fields, creadoEn: { timestampValue: ahora }, actualizadoEn: { timestampValue: ahora } } },
    currentDocument: { exists: false },
  });
}
if (writes.length) {
  const token = await obtenerToken();
  const r = await fetch(`${base}:commit`, {
    method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  });
  if (!r.ok) throw new Error(`Firestore alta: HTTP ${r.status}; no se asignaron roles.`);
}
for (const u of usuarios) {
  await auth.setCustomUserClaims(u.registro.uid, u.claims);
  const config = JSON.parse(readFileSync(new URL('../mobile/firebase.production.json', import.meta.url)));
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password, returnSecureToken: true }),
  });
  const sesion = await r.json();
  if (!r.ok) throw new Error(`Acceso ${u.claims.rol} rechazado: ${sesion.error?.message ?? r.status}. No se cambia su clave.`);
  const claims = JSON.parse(Buffer.from(sesion.idToken.split('.')[1], 'base64url'));
  if (Object.entries(u.claims).some(([k, v]) => claims[k] !== v)) throw new Error('Sesion con permisos inesperados.');
  console.log(`OK: acceso y rol ${u.claims.rol} verificados.`);
}
