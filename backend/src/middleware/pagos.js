import { entorno } from '../config/entorno.js';
import { errores } from '../infra/errores.js';

// El modo demo permite ensayar la imputación, nunca sustituir un cobro
// cuando la integración externa tiene credenciales configuradas.
export function exigirPagoSimulado(_req, _res, next) {
  if (!entorno.mercadoPago.simulado) {
    return next(errores.sinPermiso('Los pagos simulados están deshabilitados con Mercado Pago configurado.'));
  }
  next();
}

export function exigirMercadoPagoActivo(_req, _res, next) {
  if (entorno.mercadoPago.simulado) {
    return next(errores.servicioExterno('Mercado Pago'));
  }
  next();
}
