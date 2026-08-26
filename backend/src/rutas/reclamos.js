import { Router } from 'express';

import { rutas, FieldValue, aObjeto } from '../infra/firebase.js';
import { asincrono, errores } from '../infra/errores.js';
import { autenticar, exigirComplejo, exigirRol, ROLES } from '../middleware/autenticar.js';
import { clasificarYGuardar, corregirClasificacion, cambiarEstado, bandeja, metricas } from '../servicios/reclamos.js';

const router = Router({ mergeParams: true });
router.use(autenticar, exigirComplejo);

router.post('/', exigirRol(ROLES.RESIDENTE), asincrono(async (req, res) => {
  const descripcion = String(req.body?.descripcion ?? '').trim();
  if (descripcion.length < 10 || descripcion.length > 1000) throw errores.datosInvalidos({ descripcion: 'debe tener entre 10 y 1000 caracteres' });
  const ref = rutas.reclamos(req.complejoId).doc();
  await ref.set({
    numero: ref.id.slice(0, 6).toUpperCase(), descripcion,
    fotoUrl: req.body.fotoUrl ?? null,
    unidadId: req.usuario.unidadId,
    autorUid: req.usuario.uid,
    estado: 'pendiente', prioridad: 0,
    historialEstados: [{ de: null, a: 'pendiente', porUid: req.usuario.uid, en: new Date().toISOString() }],
    creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
  });
  const clasificacion = await clasificarYGuardar({ complejoId: req.complejoId, reclamoId: ref.id });
  res.status(201).json({ ...aObjeto(await ref.get()), clasificacion });
}));

router.get('/bandeja', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  res.json(await bandeja({ complejoId: req.complejoId, estado: req.query.estado ?? null, area: req.query.area ?? null }));
}));

router.get('/metricas', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  res.json(await metricas({ complejoId: req.complejoId }));
}));

router.patch('/:reclamoId/estado', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  res.json(await cambiarEstado({
    complejoId: req.complejoId, reclamoId: req.params.reclamoId,
    estado: req.body.estado, nota: req.body.nota ?? null,
    proveedorId: req.body.proveedorId ?? null, actorUid: req.usuario.uid,
  }));
}));

router.patch('/:reclamoId/clasificacion', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  res.json(await corregirClasificacion({
    complejoId: req.complejoId, reclamoId: req.params.reclamoId,
    area: req.body.area, urgencia: req.body.urgencia, adminUid: req.usuario.uid,
  }));
}));

export default router;

