/**
 * Firebase Cloud Messaging - avisos push.
 *
 * Tres momentos en los que el sistema avisa:
 *   - la administracion manda un aviso al complejo (corte de agua, asamblea);
 *   - entra la visita que un residente autorizo;
 *   - una partida critica de obra se atrasa y corre la fecha de fin.
 *
 * El envio nunca hace fallar la operacion que lo dispara. Si FCM esta caido,
 * el ingreso de la visita ya quedo registrado: lo que se pierde es el aviso,
 * no el dato. Por eso todas las funciones devuelven un resultado y no lanzan.
 */

import { mensajeria } from '../infra/firebase.js';
import { entorno } from '../config/entorno.js';
import { log } from '../infra/log.js';

/** Tope de tokens por lote que acepta la API de FCM. */
const TOPE_LOTE = 500;

/**
 * Manda una notificacion a una lista de tokens de dispositivo.
 * Devuelve los tokens que ya no sirven para que el backend los borre: un token
 * invalido que nadie limpia hace que cada envio futuro falle en silencio.
 */
export async function enviarATokens({ tokens, titulo, cuerpo, datos = {}, canal = 'habita_general' }) {
  const limpios = [...new Set((tokens ?? []).filter(Boolean))];
  if (limpios.length === 0) return { enviados: 0, fallidos: 0, tokensInvalidos: [], omitido: 'sin_tokens' };
  if (!entorno.fcm.activo) return { enviados: 0, fallidos: 0, tokensInvalidos: [], omitido: 'fcm_desactivado' };

  const tokensInvalidos = [];
  let enviados = 0;
  let fallidos = 0;

  for (let i = 0; i < limpios.length; i += TOPE_LOTE) {
    const lote = limpios.slice(i, i + TOPE_LOTE);
    try {
      const respuesta = await mensajeria().sendEachForMulticast({
        tokens: lote,
        notification: { title: titulo, body: cuerpo },
        // Los datos viajan como strings: FCM no acepta otra cosa.
        data: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, String(v)])),
        android: {
          priority: 'high',
          notification: { channelId: canal, sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
      });

      enviados += respuesta.successCount;
      fallidos += respuesta.failureCount;

      respuesta.responses.forEach((r, indice) => {
        const codigo = r.error?.code ?? '';
        if (codigo.includes('registration-token-not-registered') || codigo.includes('invalid-argument')) {
          tokensInvalidos.push(lote[indice]);
        }
      });
    } catch (error) {
      fallidos += lote.length;
      log.aviso('Fallo un lote de notificaciones push', { motivo: error.message, tamano: lote.length });
    }
  }

  log.info('Notificaciones enviadas', { enviados, fallidos, invalidos: tokensInvalidos.length });
  return { enviados, fallidos, tokensInvalidos };
}

/** Textos de los avisos del sistema, en un solo lugar para poder ajustarlos. */
export const avisos = {
  visitaIngreso: ({ nombreVisita, punto, hora }) => ({
    titulo: 'Ingreso registrado',
    cuerpo: `${nombreVisita} ingreso por ${punto} a las ${hora}.`,
    canal: 'habita_accesos',
  }),

  accesoRechazado: ({ nombreVisita, motivo }) => ({
    titulo: 'Ingreso rechazado',
    cuerpo: `No se dejo pasar a ${nombreVisita}: ${motivo}`,
    canal: 'habita_accesos',
  }),

  periodoCerrado: ({ nomenclatura, periodo, monto }) => ({
    titulo: `${nomenclatura} de ${periodo} disponible`,
    cuerpo: `Ya podes ver el detalle y pagar. Total: ${monto}.`,
    canal: 'habita_expensas',
  }),

  pagoAcreditado: ({ monto, periodo }) => ({
    titulo: 'Pago acreditado',
    cuerpo: `Recibimos ${monto} para el periodo ${periodo}. Gracias.`,
    canal: 'habita_expensas',
  }),

  reclamoActualizado: ({ numero, estado }) => ({
    titulo: `Tu reclamo #${numero} cambio de estado`,
    cuerpo: `Ahora esta ${estado}.`,
    canal: 'habita_reclamos',
  }),

  obraAtrasada: ({ obra, dias, nuevaFecha }) => ({
    titulo: `La obra "${obra}" se atraso`,
    cuerpo: `Se corrio ${dias} dia(s). Nueva fecha estimada de fin: ${nuevaFecha}.`,
    canal: 'habita_obras',
  }),

  avisoAdministracion: ({ titulo, cuerpo }) => ({
    titulo, cuerpo, canal: 'habita_general',
  }),
};
