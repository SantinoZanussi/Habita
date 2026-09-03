/**
 * NUCLEO 3 - Clasificacion de reclamos por IA.
 *
 * El residente escribe en lenguaje natural y saca una foto. El sistema clasifica
 * AREA RESPONSABLE y URGENCIA, y sugiere que hacer. La administracion recibe la
 * bandeja ya priorizada en vez de leer cuarenta mensajes de WhatsApp.
 *
 * Tres decisiones que conviene poder defender:
 *
 *  1. La API key vive SOLO aca. Si la clasificacion se hiciera desde la app,
 *     la key viajaria dentro del APK y cualquiera podria extraerla.
 *
 *  2. El modelo devuelve un NIVEL DE CONFIANZA y la administracion puede
 *     corregir la clasificacion. Las correcciones quedan registradas. Es
 *     honesto sobre los limites del modelo en vez de vender infalibilidad.
 *
 *  3. Si la API no responde, el reclamo NO se pierde: cae a un clasificador
 *     por palabras clave, se marca el origen y se sigue. Un reclamo de un caño
 *     roto no puede depender de que un servicio externo este arriba.
 */

import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';

import { entorno } from '../config/entorno.js';
import { log } from '../infra/log.js';

export const AREAS = Object.freeze([
  'plomeria', 'electricidad', 'seguridad', 'limpieza', 'estructura',
  'climatizacion', 'ascensores', 'espacios_comunes', 'otro',
]);

export const URGENCIAS = Object.freeze(['baja', 'media', 'alta', 'critica']);

/** Peso de cada urgencia para ordenar la bandeja del panel. */
export const PRIORIDAD = Object.freeze({ critica: 4, alta: 3, media: 2, baja: 1 });

const ESQUEMA_CLASIFICACION = {
  type: 'object',
  properties: {
    area: {
      type: 'string',
      enum: [...AREAS],
      description: 'Area responsable de resolver el reclamo.',
    },
    urgencia: {
      type: 'string',
      enum: [...URGENCIAS],
      description:
        'critica: hay riesgo para las personas o el edificio y requiere atencion inmediata. ' +
        'alta: afecta el uso normal de la unidad o de un espacio comun. ' +
        'media: molesta pero puede esperar unos dias. baja: mejora o mantenimiento.',
    },
    confianza: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description: 'Que tan seguro estas de la clasificacion, de 0 a 100.',
    },
    resumen: {
      type: 'string',
      description: 'El reclamo resumido en una linea, para la bandeja del panel. Maximo 90 caracteres.',
    },
    accionSugerida: {
      type: 'string',
      description: 'Que conviene hacer primero. Una oracion, concreta.',
    },
    requiereIngresoProveedor: {
      type: 'boolean',
      description: 'Si resolverlo exige que entre alguien externo al complejo.',
    },
  },
  required: ['area', 'urgencia', 'confianza', 'resumen', 'accionSugerida', 'requiereIngresoProveedor'],
  additionalProperties: false,
};

const INSTRUCCIONES = `Sos el clasificador de reclamos de Habita, un sistema de administracion de complejos residenciales en Argentina.

Recibis el reclamo tal como lo escribio un residente (con sus errores de tipeo y su forma de hablar) y, a veces, una foto.

Clasificalo con criterio de administrador de consorcio:
- Priorizá el riesgo real sobre el enojo del texto. Un vecino furioso por un ruido no genera una urgencia critica; una perdida de gas descripta con calma, si.
- "critica" se reserva para riesgo de personas o de la estructura: gas, incendio, electricidad expuesta, ascensor con gente adentro, derrumbe, inundacion activa.
- Si la descripcion es ambigua o la foto no aporta, bajá la confianza. Es preferible una confianza de 45 honesta que una de 90 inventada: la administracion ve ese numero y decide si revisar.
- El resumen se lee en una tabla: sin adjetivos, sin repetir el texto original entero.`;

/** Cliente perezoso: no se construye si no hay key configurada. */
let clienteIa = null;
function clienteAnthropic() {
  if (!clienteIa) clienteIa = new Anthropic({ apiKey: entorno.ia.apiKey });
  return clienteIa;
}

function validarSalida(salida) {
  if (!salida || typeof salida !== 'object') throw new Error('La IA no devolvio un objeto');
  if (!AREAS.includes(salida.area)) throw new Error('Area devuelta por IA fuera del esquema');
  if (!URGENCIAS.includes(salida.urgencia)) throw new Error('Urgencia devuelta por IA fuera del esquema');
  if (!Number.isInteger(salida.confianza) || salida.confianza < 0 || salida.confianza > 100) {
    throw new Error('Confianza devuelta por IA fuera del esquema');
  }
  if (typeof salida.resumen !== 'string' || typeof salida.accionSugerida !== 'string') {
    throw new Error('Textos devueltos por IA fuera del esquema');
  }
  if (typeof salida.requiereIngresoProveedor !== 'boolean') {
    throw new Error('Indicador de proveedor devuelto por IA fuera del esquema');
  }
  return salida;
}

async function clasificarConGemini({ pedido, imagen }) {
  const partes = [];
  if (imagen) {
    partes.push({ inlineData: { mimeType: imagen.media_type, data: imagen.data } });
  }
  partes.push({ text: pedido });

  const abortador = new AbortController();
  const reloj = setTimeout(() => abortador.abort(), 20_000);
  try {
    const base = entorno.ia.urlBase.replace(/\/$/, '');
    const respuesta = await fetch(
      `${base}/models/${encodeURIComponent(entorno.ia.modelo)}:generateContent`,
      {
        method: 'POST',
        signal: abortador.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': entorno.ia.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: INSTRUCCIONES }] },
          contents: [{ role: 'user', parts: partes }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
            responseMimeType: 'application/json',
            responseJsonSchema: ESQUEMA_CLASIFICACION,
          },
        }),
      }
    );

    const cuerpo = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      throw new Error(`Gemini respondio ${respuesta.status}: ${cuerpo.error?.message ?? 'error desconocido'}`);
    }
    const texto = cuerpo.candidates?.[0]?.content?.parts
      ?.map((parte) => parte.text ?? '').join('').trim();
    if (!texto) throw new Error('Gemini no devolvio contenido');
    const salida = validarSalida(JSON.parse(texto));
    return {
      ...salida,
      resumen: salida.resumen.slice(0, 120),
      origen: 'ia',
      proveedor: 'gemini',
      modelo: entorno.ia.modelo,
      tokens: {
        entrada: cuerpo.usageMetadata?.promptTokenCount ?? 0,
        salida: cuerpo.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Descarga una imagen y la deja en base64 para mandarsela al modelo.
 * Tope de 5 MB: una foto de celular pesa menos y evita que un archivo enorme
 * cuelgue la clasificacion.
 */
async function imagenEnBase64(url) {
  const TOPE = 5 * 1024 * 1024;
  const abortador = new AbortController();
  const reloj = setTimeout(() => abortador.abort(), 8000);
  try {
    const respuesta = await fetch(url, { signal: abortador.signal });
    if (!respuesta.ok) return null;

    const tipo = respuesta.headers.get('content-type') ?? '';
    if (!/^image\/(jpeg|png|webp|gif)$/.test(tipo)) return null;

    const buffer = Buffer.from(await respuesta.arrayBuffer());
    if (buffer.length > TOPE) return null;

    return { media_type: tipo, data: buffer.toString('base64') };
  } catch (error) {
    log.aviso('No se pudo descargar la foto del reclamo', { motivo: error.message });
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Clasificador de respaldo por palabras clave.
 *
 * No pretende ser inteligente: pretende que el sistema siga funcionando cuando
 * la API de IA no responde. Se marca con `origen: 'palabras_clave'` y confianza
 * baja, para que la administracion sepa que ese reclamo hay que mirarlo.
 */
export function clasificarPorPalabrasClave(descripcion) {
  const texto = String(descripcion ?? '').toLowerCase();
  const tiene = (...palabras) => palabras.some((p) => texto.includes(p));

  let area = 'otro';
  if (tiene('gas', 'agua', 'caño', 'cano', 'perdida', 'pérdida', 'canilla', 'inodoro', 'cloaca', 'destapa', 'humedad', 'filtracion', 'filtración', 'goteo'))
    area = 'plomeria';
  else if (tiene('luz', 'electric', 'tablero', 'enchufe', 'cortocircuito', 'lampara', 'lámpara', 'foco', 'disyuntor', 'cable'))
    area = 'electricidad';
  else if (tiene('ascensor', 'montacarga'))
    area = 'ascensores';
  else if (tiene('aire', 'calefacc', 'caldera', 'termotanque', 'split', 'radiador'))
    area = 'climatizacion';
  else if (tiene('camara', 'cámara', 'porton', 'portón', 'reja', 'cerradura', 'alarma', 'inseguridad', 'robo', 'baliza'))
    area = 'seguridad';
  else if (tiene('basura', 'residuo', 'limpieza', 'sucio', 'olor', 'plaga', 'cucaracha', 'rata'))
    area = 'limpieza';
  else if (tiene('grieta', 'rajadura', 'techo', 'pared', 'balcon', 'balcón', 'mamposteria', 'revoque', 'desprend'))
    area = 'estructura';
  else if (tiene('sum', 'pileta', 'parrilla', 'gimnasio', 'cancha', 'quincho', 'jardin', 'jardín', 'ascensor social'))
    area = 'espacios_comunes';

  let urgencia = 'media';
  if (tiene('gas', 'fuego', 'incendio', 'humo', 'chispa', 'cortocircuito', 'derrumbe', 'atrapad', 'inunda'))
    urgencia = 'critica';
  else if (tiene('urgente', 'no funciona', 'sin agua', 'sin luz', 'roto', 'no anda', 'perdida', 'pérdida'))
    urgencia = 'alta';
  else if (tiene('ruido', 'molesto', 'pintura', 'estetic', 'estétic', 'sugerencia'))
    urgencia = 'baja';

  return {
    area,
    urgencia,
    confianza: 35,
    resumen: String(descripcion ?? '').trim().slice(0, 90),
    accionSugerida: 'Revisar manualmente: se clasifico sin IA porque el servicio no respondio.',
    requiereIngresoProveedor: area !== 'otro',
    origen: 'palabras_clave',
    modelo: null,
  };
}

/**
 * Clasifica un reclamo. Nunca lanza: si algo falla, devuelve la clasificacion
 * por palabras clave. Un reclamo siempre entra al sistema.
 *
 * @param {object} entrada
 * @param {string} entrada.descripcion
 * @param {string} [entrada.fotoUrl]
 * @param {string} [entrada.tipoComplejo]  Contexto: un lote no tiene ascensor.
 * @param {string} [entrada.ubicacion]     "Departamento 3B", "Lote 42", "SUM".
 */
export async function clasificarReclamo({ descripcion, fotoUrl = null, tipoComplejo = 'edificio', ubicacion = '' }) {
  if (entorno.ia.simulado) {
    log.aviso('IA en modo simulado: se clasifica por palabras clave');
    return clasificarPorPalabrasClave(descripcion);
  }

  let imagen = null;

  if (fotoUrl) {
    imagen = await imagenEnBase64(fotoUrl);
  }

  const pedido = [
    `Tipo de complejo: ${tipoComplejo}`,
    ubicacion ? `Ubicacion: ${ubicacion}` : null,
    '',
    'Reclamo del residente:',
    descripcion,
  ].filter(Boolean).join('\n');

  try {
    if (entorno.ia.proveedor === 'gemini') {
      return await clasificarConGemini({ pedido, imagen });
    }

    const contenido = [];
    if (imagen) {
      contenido.push({
        type: 'image',
        source: { type: 'base64', media_type: imagen.media_type, data: imagen.data },
      });
    }
    contenido.push({ type: 'text', text: pedido });

    const respuesta = await clienteAnthropic().messages.parse({
      model: entorno.ia.modelo,
      max_tokens: 2000,
      system: INSTRUCCIONES,
      // La clasificacion es una tarea acotada: no hace falta gastar en
      // razonamiento profundo y la latencia importa (el residente espera).
      output_config: {
        effort: 'low',
        format: jsonSchemaOutputFormat(ESQUEMA_CLASIFICACION),
      },
      messages: [{ role: 'user', content: contenido }],
    });

    if (respuesta.stop_reason === 'refusal') {
      log.aviso('La IA rechazo clasificar el reclamo', { categoria: respuesta.stop_details?.category });
      return clasificarPorPalabrasClave(descripcion);
    }

    const salida = respuesta.parsed_output;
    if (!salida) {
      log.aviso('La IA no devolvio una clasificacion parseable');
      return clasificarPorPalabrasClave(descripcion);
    }

    return {
      ...validarSalida(salida),
      resumen: String(salida.resumen).slice(0, 120),
      origen: 'ia',
      proveedor: 'anthropic',
      modelo: entorno.ia.modelo,
      tokens: {
        entrada: respuesta.usage?.input_tokens ?? 0,
        salida: respuesta.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    if (entorno.ia.proveedor === 'anthropic' && error instanceof Anthropic.RateLimitError) {
      log.aviso('IA con limite de peticiones alcanzado, se usa el respaldo');
    } else if (entorno.ia.proveedor === 'anthropic' && error instanceof Anthropic.AuthenticationError) {
      log.error('La API key de IA es invalida');
    } else if (entorno.ia.proveedor === 'anthropic' && error instanceof Anthropic.APIError) {
      log.aviso('Error de la API de IA', { estado: error.status, mensaje: error.message });
    } else {
      log.aviso('Fallo la clasificacion por IA', { motivo: error.message });
    }
    return clasificarPorPalabrasClave(descripcion);
  }
}

/** Ordena la bandeja: primero lo critico, y dentro de eso lo mas viejo. */
export function prioridadDe(clasificacion) {
  return PRIORIDAD[clasificacion?.urgencia] ?? 1;
}
