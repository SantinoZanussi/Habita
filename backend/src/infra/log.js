/**
 * Log estructurado, sin dependencias.
 *
 * En desarrollo sale legible con color; en produccion sale JSON por linea,
 * que es lo que esperan Railway, Render y Cloud Run para poder filtrar.
 */

import { entorno } from '../config/entorno.js';

const enProduccion = entorno.modo === 'production';

const COLORES = {
  debug: '\x1b[90m', info: '\x1b[36m', aviso: '\x1b[33m', error: '\x1b[31m', reset: '\x1b[0m',
};

/** Campos que nunca se escriben en un log, ni siquiera en desarrollo. */
const CAMPOS_SENSIBLES = [
  'password', 'contrasena', 'token', 'accessToken', 'apiKey', 'authorization',
  'secreto', 'secretoQr', 'idToken', 'codigo', 'codigoQr',
];

function limpiar(valor, profundidad = 0) {
  if (profundidad > 4 || valor === null || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) return valor.slice(0, 20).map((v) => limpiar(v, profundidad + 1));
  const salida = {};
  for (const [clave, v] of Object.entries(valor)) {
    salida[clave] = CAMPOS_SENSIBLES.some((s) => clave.toLowerCase().includes(s.toLowerCase()))
      ? '[oculto]'
      : limpiar(v, profundidad + 1);
  }
  return salida;
}

function emitir(nivel, mensaje, contexto = {}) {
  const registro = { ts: new Date().toISOString(), nivel, mensaje, ...limpiar(contexto) };
  if (enProduccion) {
    console.log(JSON.stringify(registro));
    return;
  }
  const color = COLORES[nivel] ?? '';
  const extra = Object.keys(contexto).length > 0 ? ` ${JSON.stringify(limpiar(contexto))}` : '';
  console.log(`${color}${nivel.toUpperCase().padEnd(5)}${COLORES.reset} ${mensaje}${extra}`);
}

export const log = {
  debug: (mensaje, contexto) => { if (!enProduccion) emitir('debug', mensaje, contexto); },
  info: (mensaje, contexto) => emitir('info', mensaje, contexto),
  aviso: (mensaje, contexto) => emitir('aviso', mensaje, contexto),
  error: (mensaje, contexto) => emitir('error', mensaje, contexto),
};
