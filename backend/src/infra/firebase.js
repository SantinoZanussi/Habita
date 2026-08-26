/**
 * Conexion con Firebase mediante el Admin SDK.
 *
 * El Admin SDK NO pasa por las reglas de Firestore: tiene acceso total. Por eso
 * el backend es el unico que puede escribir liquidaciones, eventos de acceso y
 * avances de obra, y por eso su codigo no expone ningun endpoint que edite o
 * borre las colecciones append-only. La regla protege al cliente; la disciplina
 * del backend protege al resto.
 *
 * En desarrollo apunta a los emuladores, asi que se puede trabajar sin tocar
 * datos reales y sin conexion a internet.
 */

import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync, existsSync } from 'node:fs';

import { entorno } from '../config/entorno.js';
import { log } from './log.js';

function inicializar() {
  if (getApps().length > 0) return getApps()[0];

  if (entorno.firebase.usarEmuladores) {
    // Estas variables son las que hacen que el Admin SDK hable con el emulador.
    process.env.FIRESTORE_EMULATOR_HOST = entorno.firebase.emuladorFirestore;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = entorno.firebase.emuladorAuth;
    if (entorno.firebase.emuladorStorage) {
      process.env.FIREBASE_STORAGE_EMULATOR_HOST = entorno.firebase.emuladorStorage;
    }
    log.info('Firebase apuntando a los emuladores', {
      firestore: entorno.firebase.emuladorFirestore,
      auth: entorno.firebase.emuladorAuth,
    });
    return initializeApp({ projectId: entorno.firebase.projectId });
  }

  const ruta = entorno.firebase.credencialesPath;
  if (ruta && existsSync(ruta)) {
    const credencial = JSON.parse(readFileSync(ruta, 'utf8'));
    log.info('Firebase con clave de servicio', { proyecto: credencial.project_id });
    return initializeApp({
      credential: cert(credencial),
      projectId: credencial.project_id,
      storageBucket: entorno.firebase.storageBucket || undefined,
    });
  }

  log.info('Firebase con credenciales por defecto del entorno');
  return initializeApp({
    credential: applicationDefault(),
    projectId: entorno.firebase.projectId,
    storageBucket: entorno.firebase.storageBucket || undefined,
  });
}

export const app = inicializar();
export const db = getFirestore(app);
export const auth = getAuth(app);
export const mensajeria = () => getMessaging(app);
export { FieldValue, Timestamp };

db.settings({ ignoreUndefinedProperties: true });

// ---------------------------------------------------------------------------
//  Atajos de rutas: toda la base cuelga de complejos/{complejoId}
// ---------------------------------------------------------------------------

export const rutas = {
  usuarios: () => db.collection('usuarios'),
  usuario: (uid) => db.collection('usuarios').doc(uid),

  complejos: () => db.collection('complejos'),
  complejo: (cid) => db.collection('complejos').doc(cid),

  unidades: (cid) => rutas.complejo(cid).collection('unidades'),
  unidad: (cid, id) => rutas.unidades(cid).doc(id),

  amenities: (cid) => rutas.complejo(cid).collection('amenities'),
  reservas: (cid) => rutas.complejo(cid).collection('reservas'),

  autorizaciones: (cid) => rutas.complejo(cid).collection('autorizaciones'),
  autorizacion: (cid, id) => rutas.autorizaciones(cid).doc(id),

  eventosAcceso: (cid) => rutas.complejo(cid).collection('eventosAcceso'),

  reclamos: (cid) => rutas.complejo(cid).collection('reclamos'),
  reclamo: (cid, id) => rutas.reclamos(cid).doc(id),
  proveedores: (cid) => rutas.complejo(cid).collection('proveedores'),

  periodos: (cid) => rutas.complejo(cid).collection('periodos'),
  periodo: (cid, id) => rutas.periodos(cid).doc(id),
  detalle: (cid, periodoId) => rutas.periodo(cid, periodoId).collection('detalle'),

  pagos: (cid) => rutas.complejo(cid).collection('pagos'),
  consumos: (cid) => rutas.complejo(cid).collection('consumos'),
  notificaciones: (cid) => rutas.complejo(cid).collection('notificaciones'),

  obras: (cid) => rutas.complejo(cid).collection('obras'),
  obra: (cid, id) => rutas.obras(cid).doc(id),
  partidas: (cid, obraId) => rutas.obra(cid, obraId).collection('partidas'),
  avances: (cid, obraId) => rutas.obra(cid, obraId).collection('avances'),

  candidatos: (cid) => rutas.complejo(cid).collection('candidatos'),
  contactos: () => db.collection('contactos'),
};

/** Convierte un snapshot en objeto plano con su id. */
export const aObjeto = (doc) => (doc.exists ? { id: doc.id, ...doc.data() } : null);

/** Convierte un query snapshot en array de objetos planos. */
export const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** Timestamps de auditoria que lleva todo documento que escribe el backend. */
export const sello = (uid = null) => ({
  actualizadoEn: FieldValue.serverTimestamp(),
  ...(uid ? { actualizadoPorUid: uid } : {}),
});

export const selloCreacion = (uid = null) => ({
  creadoEn: FieldValue.serverTimestamp(),
  actualizadoEn: FieldValue.serverTimestamp(),
  ...(uid ? { creadoPorUid: uid, actualizadoPorUid: uid } : {}),
});

/** Serializa Timestamps de Firestore a ISO para que la API devuelva JSON limpio. */
export function serializar(valor) {
  if (valor === null || valor === undefined) return valor;
  if (valor instanceof Timestamp) return valor.toDate().toISOString();
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) return valor.map(serializar);
  if (typeof valor === 'object') {
    if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, serializar(v)]));
  }
  return valor;
}
