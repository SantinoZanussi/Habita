/**
 * Configuracion del backend.
 *
 * Todo lo que cambia entre la maquina del aula, el emulador y produccion entra
 * por variables de entorno. Nada de credenciales en el codigo: es el requisito
 * de la materia y ademas es lo unico razonable.
 *
 * Los secretos de las APIs externas (Mercado Pago, IA) viven SOLO aca. No se
 * compilan dentro de la app Flutter ni se sirven al navegador.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
export const RAIZ_BACKEND = resolve(aqui, '../..');
export const RAIZ_PROYECTO = resolve(RAIZ_BACKEND, '..');

/**
 * Lector minimo de .env. Se hace a mano en vez de sumar `dotenv` porque son
 * quince lineas y una dependencia menos que auditar.
 */
function cargarEnv(archivo) {
  if (!existsSync(archivo)) return;
  for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const separador = limpia.indexOf('=');
    if (separador === -1) continue;
    const clave = limpia.slice(0, separador).trim();
    let valor = limpia.slice(separador + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

cargarEnv(resolve(RAIZ_PROYECTO, '.env'));
cargarEnv(resolve(RAIZ_BACKEND, '.env'));

const texto = (clave, porDefecto = '') => process.env[clave] ?? porDefecto;
const numero = (clave, porDefecto) => {
  const valor = Number(process.env[clave]);
  return Number.isFinite(valor) ? valor : porDefecto;
};
const booleano = (clave, porDefecto = false) => {
  const valor = process.env[clave];
  if (valor === undefined) return porDefecto;
  return ['1', 'true', 'si', 'yes'].includes(valor.toLowerCase());
};

function proyectoDelEntorno() {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  try {
    return JSON.parse(process.env.FIREBASE_CONFIG ?? '{}').projectId ?? 'habita-demo';
  } catch {
    return 'habita-demo';
  }
}

const proyecto = proyectoDelEntorno();
const proveedorIa = texto('IA_PROVEEDOR', 'gemini').toLowerCase();
const enInfraFirebase = Boolean(
  process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.FIREBASE_CONFIG
);
const basePublicaDefault = enInfraFirebase
  ? `https://${proyecto}.web.app`
  : 'http://localhost:5000';

export const entorno = {
  modo: texto('NODE_ENV', enInfraFirebase ? 'production' : 'development'),
  puerto: numero('PUERTO', numero('PORT', 8787)),
  basePublica: texto('PUBLIC_BASE_URL', basePublicaDefault).replace(/\/$/, ''),
  origenesPermitidos: texto(
    'ORIGENES_PERMITIDOS',
    `http://localhost:5000,http://127.0.0.1:5000,https://${proyecto}.web.app,https://${proyecto}.firebaseapp.com`
  )
    .split(',').map((o) => o.trim()).filter(Boolean),

  firebase: {
    projectId: proyecto,
    // Ruta a la clave de servicio. En emulador no hace falta.
    credencialesPath: texto('GOOGLE_APPLICATION_CREDENTIALS', ''),
    // Render permite guardar el JSON completo como variable secreta, sin
    // escribirlo en el repositorio ni depender de un archivo persistente.
    credencialesJson: texto('FIREBASE_SERVICE_ACCOUNT_JSON', ''),
    storageBucket: texto('FIREBASE_STORAGE_BUCKET', ''),
    usarEmuladores: booleano('USAR_EMULADORES', !enInfraFirebase),
    emuladorFirestore: texto('FIRESTORE_EMULATOR_HOST', 'localhost:8080'),
    emuladorAuth: texto('FIREBASE_AUTH_EMULATOR_HOST', 'localhost:9099'),
    emuladorStorage: texto('FIREBASE_STORAGE_EMULATOR_HOST', 'localhost:9199'),
  },

  // Secreto con el que se firman los QR dinamicos. En produccion tiene que ser
  // largo y aleatorio; si falta, el servidor no arranca en modo produccion.
  get secretoQr() {
    return texto('SECRETO_QR', 'habita-desarrollo-cambiar-en-produccion');
  },

  mercadoPago: {
    get accessToken() { return texto('MP_ACCESS_TOKEN', ''); },
    get urlWebhook() {
      return texto('MP_URL_WEBHOOK', `${entorno.basePublica}/api/webhooks/mercadopago`);
    },
    get urlRetorno() {
      return texto('MP_URL_RETORNO', `${entorno.basePublica}/panel/?pago=resultado`);
    },
    get secretoWebhook() { return texto('MP_SECRETO_WEBHOOK', ''); },
    /** Sin token configurado, el modulo entra en modo simulado para la demo. */
    get simulado() { return this.accessToken === ''; },
  },

  ia: {
    proveedor: proveedorIa,
    get apiKey() {
      return proveedorIa === 'gemini'
        ? texto('GEMINI_API_KEY', '')
        : texto('ANTHROPIC_API_KEY', '');
    },
    modelo: texto(
      'IA_MODELO',
      proveedorIa === 'gemini' ? 'gemini-3.5-flash-lite' : 'claude-sonnet-5'
    ),
    urlBase: texto(
      'IA_URL_BASE',
      proveedorIa === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta'
        : 'https://api.anthropic.com/v1/messages'
    ),
    get simulado() { return this.apiKey === ''; },
  },

  maps: {
    apiKey: texto('GOOGLE_MAPS_API_KEY', ''),
    get simulado() { return this.apiKey === ''; },
  },

  bcra: {
    urlBase: texto('BCRA_URL_BASE', 'https://api.bcra.gob.ar/estadisticas/v4.0'),
    /** Serie 27 del BCRA: inflacion mensual (IPC, variacion % mensual). */
    idSerieInflacion: texto('BCRA_SERIE_INFLACION', '27'),
    timeoutMs: numero('BCRA_TIMEOUT_MS', 8000),
  },

  fcm: {
    activo: booleano('FCM_ACTIVO', true),
  },

  limites: {
    /** Peticiones por minuto por IP en las rutas publicas (contacto, webhook). */
    porMinutoPublico: numero('LIMITE_PUBLICO_POR_MINUTO', 30),
    /** Peticiones por minuto por usuario autenticado. */
    porMinutoAutenticado: numero('LIMITE_AUTENTICADO_POR_MINUTO', 240),
  },
};

/**
 * Chequeo de arranque. En produccion no se tolera un secreto de desarrollo ni
 * la falta de credenciales: es preferible que el servidor no levante a que
 * levante inseguro.
 */
export function validarEntorno() {
  const problemas = [];
  const advertencias = [];

  if (entorno.modo === 'production') {
    if (entorno.secretoQr.includes('desarrollo')) {
      problemas.push('SECRETO_QR sigue siendo el valor de desarrollo');
    }
    if (entorno.firebase.usarEmuladores) {
      problemas.push('USAR_EMULADORES esta en true en produccion');
    }
    if (!entorno.firebase.credencialesPath && !entorno.firebase.credencialesJson && !process.env.FIREBASE_CONFIG) {
      problemas.push('Falta GOOGLE_APPLICATION_CREDENTIALS o FIREBASE_SERVICE_ACCOUNT_JSON');
    }
    if (!entorno.mercadoPago.simulado && !entorno.mercadoPago.secretoWebhook) {
      problemas.push('Falta MP_SECRETO_WEBHOOK para verificar pagos reales');
    }
    if (!entorno.mercadoPago.simulado && !entorno.mercadoPago.urlWebhook.startsWith('https://')) {
      problemas.push('MP_URL_WEBHOOK debe usar HTTPS');
    }
  }

  if (entorno.mercadoPago.simulado) advertencias.push('Mercado Pago en modo simulado (falta MP_ACCESS_TOKEN)');
  if (entorno.ia.simulado) advertencias.push('Clasificacion por IA en modo simulado (falta ANTHROPIC_API_KEY)');
  if (entorno.maps.simulado) advertencias.push('Google Maps en modo simulado (falta GOOGLE_MAPS_API_KEY)');

  return { problemas, advertencias, valido: problemas.length === 0 };
}
