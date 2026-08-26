/**
 * Aplicacion Express de Habita.
 *
 * El backend concentra TODA la logica de negocio y TODOS los secretos.
 * Las lecturas del cliente no pasan por aca: la app y el panel se suscriben
 * directo a Firestore, que es lo que da el tiempo real. Aca pasan solo las
 * escrituras con logica y las llamadas a servicios externos.
 */

import express from 'express';
import cors from 'cors';

import { entorno } from './config/entorno.js';
import { log } from './infra/log.js';
import { manejarErrores, noEncontrado, limitar } from './middleware/errores.js';
import montarRutas from './rutas/index.js';

export function crearApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // --- cabeceras de seguridad ---------------------------------------------
  // Se escriben a mano en vez de sumar helmet: son cinco y asi se entiende
  // exactamente que hace cada una.
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(self), camera=(self), microphone=()',
      'Strict-Transport-Security': entorno.modo === 'production'
        ? 'max-age=31536000; includeSubDomains' : '',
    });
    next();
  });

  // --- CORS ----------------------------------------------------------------
  app.use(cors({
    origin(origen, callback) {
      // Sin origen: peticiones del propio servidor, de la app movil o de curl.
      if (!origen) return callback(null, true);
      if (entorno.origenesPermitidos.includes(origen)) return callback(null, true);
      if (entorno.modo !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origen)) {
        return callback(null, true);
      }
      log.aviso('Origen bloqueado por CORS', { origen });
      return callback(null, false);
    },
    credentials: true,
    maxAge: 86_400,
  }));

  // --- cuerpo --------------------------------------------------------------
  // El webhook de Mercado Pago necesita el cuerpo crudo para verificar la firma.
  app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buffer) => { req.cuerpoCrudo = buffer; },
  }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));

  // --- log de peticiones ---------------------------------------------------
  app.use((req, res, next) => {
    const inicio = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
      // Se registran los errores y lo que tarda mas de medio segundo; el resto
      // solo en desarrollo, para no llenar el log de produccion de ruido.
      const interesante = res.statusCode >= 400 || ms > 500;
      const escribir = interesante ? log.aviso : log.debug;
      escribir(`${req.method} ${req.originalUrl} ${res.statusCode}`, {
        ms: Math.round(ms), uid: req.usuario?.uid ?? null,
      });
    });
    next();
  });

  app.use(limitar({ porMinuto: entorno.limites.porMinutoAutenticado }));

  montarRutas(app);

  app.use(noEncontrado);
  app.use(manejarErrores);

  return app;
}
