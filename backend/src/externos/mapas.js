/**
 * Google Maps - geocodificacion y mapas estaticos.
 *
 * Donde se usa:
 *   - ubicar el complejo al darlo de alta (direccion -> coordenadas);
 *   - ubicar lotes dentro de un barrio grande, donde "Lote 42" no le dice nada
 *     a un proveedor que entra por primera vez;
 *   - geolocalizar reclamos y avances de obra: la foto sola no dice donde se
 *     saco, y en un country de 500 lotes eso importa.
 *
 * La API key vive solo en el backend. El panel y la app piden la imagen del
 * mapa al backend, que la firma y la proxea. Una key de Maps expuesta en el
 * navegador es una factura ajena esperando a que alguien la encuentre.
 */

import { entorno } from '../config/entorno.js';
import { log } from '../infra/log.js';
import { pedirJson } from '../infra/reintento.js';

const GEOCODE = 'https://maps.googleapis.com/maps/api/geocode/json';
const ESTATICO = 'https://maps.googleapis.com/maps/api/staticmap';

/** Centro de CABA, para el modo simulado. */
const CENTRO_SIMULADO = { lat: -34.6037, lng: -58.3816 };

/**
 * Convierte una direccion en coordenadas.
 * Si no hay API key devuelve una coordenada simulada marcada como tal: el alta
 * del complejo no se puede bloquear porque falte una key de Maps.
 */
export async function geocodificar(direccion, { pais = 'AR' } = {}) {
  if (entorno.maps.simulado) {
    log.aviso('Google Maps simulado: coordenada aproximada');
    return {
      lat: CENTRO_SIMULADO.lat + (Math.random() - 0.5) * 0.1,
      lng: CENTRO_SIMULADO.lng + (Math.random() - 0.5) * 0.1,
      direccionNormalizada: direccion,
      precision: 'simulada',
      simulado: true,
    };
  }

  const url = `${GEOCODE}?address=${encodeURIComponent(direccion)}&region=${pais}&key=${entorno.maps.apiKey}`;

  try {
    const respuesta = await pedirJson(url, { nombre: 'Google Maps (geocode)', timeoutMs: 8000 });

    if (respuesta.status === 'ZERO_RESULTS') {
      return { encontrado: false, motivo: 'No encontramos esa direccion. Revisala o cargá las coordenadas a mano.' };
    }
    if (respuesta.status !== 'OK') {
      log.aviso('Google Maps devolvio un estado inesperado', { estado: respuesta.status });
      return { encontrado: false, motivo: 'El servicio de mapas no pudo resolver la direccion.' };
    }

    const mejor = respuesta.results[0];
    return {
      encontrado: true,
      lat: mejor.geometry.location.lat,
      lng: mejor.geometry.location.lng,
      direccionNormalizada: mejor.formatted_address,
      precision: mejor.geometry.location_type,
      placeId: mejor.place_id,
      simulado: false,
    };
  } catch (error) {
    log.aviso('Fallo la geocodificacion', { motivo: error.message });
    return { encontrado: false, motivo: 'No pudimos contactar al servicio de mapas.' };
  }
}

/**
 * Arma la URL de un mapa estatico. La devuelve el backend ya firmada para que
 * el cliente la use como `src` de una imagen sin ver nunca la API key.
 */
export function urlMapaEstatico({ lat, lng, zoom = 17, ancho = 640, alto = 360, marcadores = [] }) {
  if (entorno.maps.simulado) return null;

  const parametros = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: `${ancho}x${alto}`,
    scale: '2',
    maptype: 'roadmap',
    key: entorno.maps.apiKey,
  });

  // Marcador principal en color de marca.
  parametros.append('markers', `color:0x3E9BE4|${lat},${lng}`);
  for (const m of marcadores) {
    parametros.append('markers', `color:0x${m.color ?? '14395E'}|label:${m.etiqueta ?? ''}|${m.lat},${m.lng}`);
  }

  return `${ESTATICO}?${parametros.toString()}`;
}

/**
 * Distancia en metros entre dos coordenadas (formula de Haversine).
 *
 * Se usa para validar un avance de obra: si la foto se cargo a dos kilometros
 * del lote, algo no cierra. Es un chequeo barato que no requiere ninguna API.
 */
export function distanciaEnMetros(a, b) {
  const R = 6_371_000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Valida que una carga georreferenciada haya ocurrido cerca del complejo.
 * No bloquea: marca. Un GPS de celular adentro de un subsuelo puede errar
 * doscientos metros, y rechazar el avance por eso seria peor que anotarlo.
 */
export function validarCercania({ punto, referencia, radioMetros = 500 }) {
  if (!punto?.lat || !referencia?.lat) {
    return { verificado: false, motivo: 'sin_coordenadas' };
  }
  const distancia = distanciaEnMetros(punto, referencia);
  return {
    verificado: true,
    distanciaMetros: distancia,
    dentroDelRadio: distancia <= radioMetros,
    radioMetros,
  };
}
