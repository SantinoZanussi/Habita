/**
 * Endpoints de estado.
 *
 * `/api/salud` lo usa la plataforma de despliegue para saber si el servicio
 * esta vivo. `/api/estado` es el detalle que se mira en la demo: dice si las
 * integraciones estan reales o simuladas, y si la base responde.
 */

import { Router } from 'express';

import { entorno } from '../config/entorno.js';
import { db } from '../infra/firebase.js';
import { asincrono } from '../infra/errores.js';

const router = Router();

router.get('/salud', (_req, res) => {
  res.json({ estado: 'ok', servicio: 'habita-backend', version: '1.0.0-fase2' });
});

router.get('/estado', asincrono(async (_req, res) => {
  const inicio = Date.now();
  let firestore = 'ok';
  let latencia = null;

  try {
    await db.collection('_salud').doc('ping').get();
    latencia = Date.now() - inicio;
  } catch (error) {
    firestore = 'caido';
  }

  res.json({
    estado: firestore === 'ok' ? 'ok' : 'degradado',
    modo: entorno.modo,
    firestore: { estado: firestore, latenciaMs: latencia, emulador: entorno.firebase.usarEmuladores },
    integraciones: {
      mercadoPago: entorno.mercadoPago.simulado ? 'simulado' : 'activo',
      ia: entorno.ia.simulado ? 'simulado' : 'activo',
      maps: entorno.maps.simulado ? 'simulado' : 'activo',
      fcm: entorno.fcm.activo ? 'activo' : 'desactivado',
      bcra: 'publico',
    },
    ts: new Date().toISOString(),
  });
}));

export default router;
