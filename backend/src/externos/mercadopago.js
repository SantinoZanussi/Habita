/**
 * Integracion con Mercado Pago: cobro de expensas.
 *
 * Flujo completo:
 *   1. El residente toca "Pagar" en la app.
 *   2. El backend crea una PREFERENCIA de pago con el detalle del periodo y
 *      una `external_reference` que identifica complejo + unidad + periodo.
 *   3. La app abre el checkout de Mercado Pago.
 *   4. Mercado Pago avisa el resultado por WEBHOOK a una URL publica.
 *   5. El backend consulta el pago por su id (nunca confia en el cuerpo del
 *      webhook), lo imputa y actualiza la cuenta corriente.
 *
 * El paso 5 es el que importa: el webhook solo avisa "paso algo con el pago
 * 123". El estado real se pregunta. Si se confiara en el cuerpo del webhook,
 * cualquiera que conozca la URL podria marcar expensas como pagadas.
 *
 * MODO SIMULADO: sin MP_ACCESS_TOKEN el modulo genera preferencias falsas con
 * una URL local que dispara el mismo webhook. Sirve para desarrollar y para
 * ensayar la demo sin depender de la cuenta de Mercado Pago.
 */

import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

import { entorno } from '../config/entorno.js';
import { log } from '../infra/log.js';
import { pedirJson, ErrorHttp } from '../infra/reintento.js';
import { errores } from '../infra/errores.js';
import { aPesos } from '../dominio/dinero.js';

const API = 'https://api.mercadopago.com';

const cabeceras = (idempotencyKey) => ({
  'Authorization': `Bearer ${entorno.mercadoPago.accessToken}`,
  'Content-Type': 'application/json',
  ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
});

/**
 * Crea una preferencia de pago.
 *
 * @param {object} entrada
 * @param {string} entrada.referencia   external_reference: complejo|unidad|periodo
 * @param {string} entrada.concepto     "Expensa Julio 2026 - Unidad 3B"
 * @param {number} entrada.montoCentavos
 * @param {object} [entrada.pagador]    { email, nombre }
 */
export async function crearPreferencia({ referencia, concepto, montoCentavos, pagador = {} }) {
  if (montoCentavos <= 0) {
    throw errores.reglaDeNegocio('MONTO_INVALIDO', 'No se puede generar un cobro por un importe menor o igual a cero.');
  }

  if (entorno.mercadoPago.simulado) {
    const id = `sim-${randomUUID()}`;
    log.aviso('Mercado Pago simulado: preferencia falsa', { referencia, id });
    return {
      preferenciaId: id,
      urlPago: `/panel/pago-simulado.html?pref=${id}&ref=${encodeURIComponent(referencia)}&monto=${montoCentavos}`,
      urlPagoSandbox: null,
      simulado: true,
    };
  }

  const cuerpo = {
    items: [{
      id: referencia,
      title: concepto,
      quantity: 1,
      currency_id: 'ARS',
      unit_price: aPesos(montoCentavos),
    }],
    payer: {
      email: pagador.email ?? undefined,
      name: pagador.nombre ?? undefined,
    },
    external_reference: referencia,
    notification_url: entorno.mercadoPago.urlWebhook || undefined,
    back_urls: {
      success: entorno.mercadoPago.urlRetorno,
      pending: entorno.mercadoPago.urlRetorno,
      failure: entorno.mercadoPago.urlRetorno,
    },
    auto_return: 'approved',
    statement_descriptor: 'HABITA',
    // La preferencia caduca: un link de pago de una expensa de hace tres meses
    // no tiene por que seguir vivo.
    expires: true,
    expiration_date_to: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  };

  try {
    const respuesta = await pedirJson(`${API}/checkout/preferences`, {
      method: 'POST',
      headers: cabeceras(referencia),
      body: JSON.stringify(cuerpo),
      nombre: 'Mercado Pago (preferencia)',
      timeoutMs: 12_000,
    });

    return {
      preferenciaId: respuesta.id,
      urlPago: respuesta.init_point,
      urlPagoSandbox: respuesta.sandbox_init_point ?? null,
      simulado: false,
    };
  } catch (error) {
    log.error('No se pudo crear la preferencia de Mercado Pago', {
      referencia, estado: error?.estado, cuerpo: error?.cuerpo,
    });
    throw errores.servicioExterno('Mercado Pago', error);
  }
}

/**
 * Consulta el estado real de un pago. Es el paso que hace confiable al webhook.
 */
export async function consultarPago(pagoId) {
  if (entorno.mercadoPago.simulado || String(pagoId).startsWith('sim-')) {
    return {
      id: pagoId,
      estado: 'approved',
      montoCentavos: null,
      referencia: null,
      medio: 'simulado',
      fecha: new Date().toISOString(),
      simulado: true,
    };
  }

  try {
    const pago = await pedirJson(`${API}/v1/payments/${pagoId}`, {
      headers: cabeceras(),
      nombre: 'Mercado Pago (consulta)',
      timeoutMs: 12_000,
    });

    return {
      id: String(pago.id),
      estado: pago.status,                       // approved | pending | rejected | refunded ...
      detalleEstado: pago.status_detail ?? null,
      montoCentavos: Math.round((pago.transaction_amount ?? 0) * 100),
      referencia: pago.external_reference ?? null,
      medio: pago.payment_method_id ?? null,
      tipoMedio: pago.payment_type_id ?? null,
      fecha: pago.date_approved ?? pago.date_created ?? new Date().toISOString(),
      pagadorEmail: pago.payer?.email ?? null,
      simulado: false,
    };
  } catch (error) {
    if (error instanceof ErrorHttp && error.estado === 404) {
      throw errores.noEncontrado('El pago');
    }
    throw errores.servicioExterno('Mercado Pago', error);
  }
}

/**
 * Verifica la firma del webhook.
 *
 * Mercado Pago manda una cabecera `x-signature` con `ts` y `v1`, donde `v1` es
 * el HMAC-SHA256 de `id:<dataId>;request-id:<xRequestId>;ts:<ts>;` firmado con
 * el secreto del webhook. Sin esta verificacion, cualquiera que descubra la URL
 * publica del backend puede simular pagos aprobados.
 */
export function verificarFirmaWebhook({ firma, requestId, dataId }) {
  if (!entorno.mercadoPago.secretoWebhook) {
    // Sin secreto configurado no se puede verificar. Se acepta pero se avisa,
    // porque igual el estado del pago se consulta despues contra la API.
    log.aviso('Webhook de Mercado Pago sin secreto configurado: no se verifica la firma');
    return { valido: true, verificado: false };
  }

  const partes = Object.fromEntries(
    String(firma ?? '').split(',').map((p) => p.split('=').map((s) => s.trim()))
  );
  if (!partes.ts || !partes.v1) return { valido: false, verificado: true, motivo: 'firma_incompleta' };

  const manifiesto = `id:${dataId};request-id:${requestId};ts:${partes.ts};`;
  const esperada = createHmac('sha256', entorno.mercadoPago.secretoWebhook).update(manifiesto).digest('hex');

  const a = Buffer.from(esperada);
  const b = Buffer.from(partes.v1);
  const coincide = a.length === b.length && timingSafeEqual(a, b);

  // Ventana de 5 minutos contra reenvio de notificaciones viejas.
  const antiguedad = Math.abs(Date.now() - Number(partes.ts) * 1000);
  if (coincide && antiguedad > 5 * 60_000) {
    return { valido: false, verificado: true, motivo: 'firma_vencida' };
  }

  return { valido: coincide, verificado: true, motivo: coincide ? null : 'firma_invalida' };
}

/** Arma la referencia externa que viaja con el pago y vuelve en el webhook. */
export function armarReferencia({ complejoId, unidadId, periodoId }) {
  return `${complejoId}|${unidadId}|${periodoId}`;
}

export function leerReferencia(referencia) {
  const [complejoId, unidadId, periodoId] = String(referencia ?? '').split('|');
  return complejoId && unidadId && periodoId ? { complejoId, unidadId, periodoId } : null;
}
