/**
 * Reintento con backoff exponencial y jitter para llamadas a servicios externos.
 *
 * Requisito de resiliencia: la aplicacion tiene que manejar fallos en servicios
 * externos. Si la API del BCRA tarda o Mercado Pago devuelve un 502, no se
 * puede propagar el error crudo ni colgar la peticion para siempre.
 *
 * Que SI se reintenta: errores de red, timeouts, 429 y 5xx.
 * Que NO se reintenta: 4xx que no sean 429. Reintentar un 400 diez veces solo
 * hace mas lento el error; los datos van a seguir estando mal.
 *
 * El jitter (ruido aleatorio en la espera) evita que veinte peticiones que
 * fallaron juntas reintenten todas en el mismo milisegundo.
 */

import { log } from './log.js';

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

export class ErrorHttp extends Error {
  constructor(estado, cuerpo, url) {
    super(`HTTP ${estado} en ${url}`);
    this.name = 'ErrorHttp';
    this.estado = estado;
    this.cuerpo = cuerpo;
    this.url = url;
  }
  get reintentable() {
    return this.estado === 429 || this.estado >= 500;
  }
}

export function esReintentable(error) {
  if (error instanceof ErrorHttp) return error.reintentable;
  // Errores de red de undici / fetch.
  return ['AbortError', 'TypeError', 'FetchError'].includes(error?.name)
    || ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(error?.code)
    || error?.cause?.code === 'ECONNRESET';
}

/**
 * Ejecuta `tarea` reintentando ante fallas transitorias.
 *
 * @param {Function} tarea               Funcion async a ejecutar (recibe el numero de intento).
 * @param {object} opciones
 * @param {number} [opciones.intentos]   Cantidad total de intentos (incluye el primero).
 * @param {number} [opciones.esperaBase] Milisegundos de la primera espera.
 * @param {number} [opciones.esperaMax]
 * @param {string} [opciones.nombre]     Para el log.
 */
export async function conReintento(tarea, { intentos = 3, esperaBase = 400, esperaMax = 5000, nombre = 'operacion' } = {}) {
  let ultimoError;

  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      return await tarea(intento);
    } catch (error) {
      ultimoError = error;
      if (!esReintentable(error) || intento === intentos) break;

      const exponencial = Math.min(esperaBase * 2 ** (intento - 1), esperaMax);
      const espera = Math.round(exponencial * (0.5 + Math.random() * 0.5));
      log.aviso(`${nombre}: intento ${intento} de ${intentos} fallo, reintentando`, {
        espera, motivo: error.message,
      });
      await dormir(espera);
    }
  }

  throw ultimoError;
}

/**
 * `fetch` con timeout, reintento y parseo de JSON.
 * Es la unica puerta por la que el backend habla con el mundo exterior.
 */
export async function pedirJson(url, { timeoutMs = 10_000, intentos = 3, nombre = 'api externa', ...opciones } = {}) {
  return conReintento(async () => {
    const abortador = new AbortController();
    const reloj = setTimeout(() => abortador.abort(), timeoutMs);
    try {
      const respuesta = await fetch(url, { ...opciones, signal: abortador.signal });
      const texto = await respuesta.text();
      let cuerpo;
      try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = texto; }

      if (!respuesta.ok) throw new ErrorHttp(respuesta.status, cuerpo, url);
      return cuerpo;
    } finally {
      clearTimeout(reloj);
    }
  }, { intentos, nombre });
}
