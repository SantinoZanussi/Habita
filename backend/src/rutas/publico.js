import { Router } from 'express';

import { rutas, FieldValue } from '../infra/firebase.js';
import { asincrono, errores } from '../infra/errores.js';
import { limitar } from '../middleware/errores.js';
import { entorno } from '../config/entorno.js';
import { verificarFirmaWebhook } from '../externos/mercadopago.js';
import { procesarPago } from '../servicios/pagos.js';

const router = Router();
const limitePublico = limitar({ porMinuto: entorno.limites.porMinutoPublico });

router.post('/contacto', limitePublico, asincrono(async (req, res) => {
  const nombre = String(req.body?.nombre ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const mensaje = String(req.body?.mensaje ?? '').trim();
  if (nombre.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || mensaje.length < 10) {
    throw errores.datosInvalidos({ formulario: 'Completá nombre, correo válido y un mensaje de al menos 10 caracteres.' });
  }
  const ref = rutas.contactos().doc();
  await ref.set({ nombre, email, mensaje, estado: 'nuevo', creadoEn: FieldValue.serverTimestamp() });
  res.status(201).json({ id: ref.id, mensaje: 'Recibimos tu consulta. Te vamos a contactar pronto.' });
}));

router.post('/webhooks/mercadopago', limitePublico, asincrono(async (req, res) => {
  const dataId = String(req.body?.data?.id ?? req.query['data.id'] ?? '');
  const verificacion = verificarFirmaWebhook({
    firma: req.get('x-signature'),
    requestId: req.get('x-request-id'),
    dataId,
  });
  if (!verificacion.valido) throw errores.sinPermiso('La firma del webhook no es válida.');
  if (!dataId) return res.status(200).json({ recibido: true, procesado: false, motivo: 'sin_pago' });
  const resultado = await procesarPago({ pagoId: dataId });
  res.status(200).json({ recibido: true, ...resultado });
}));

export default router;

