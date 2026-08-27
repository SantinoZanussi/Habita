import { Router } from 'express';

import { rutas, FieldValue, aObjeto } from '../infra/firebase.js';
import { asincrono, errores } from '../infra/errores.js';
import { autenticar, exigirComplejo, exigirRol, ROLES } from '../middleware/autenticar.js';
import { recalcularCronograma, registrarAvance, sincronizarCola } from '../servicios/obras.js';

const router = Router({ mergeParams: true });
router.use(autenticar, exigirComplejo);

router.post('/', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  if (String(req.body?.nombre ?? '').trim().length < 3) throw errores.datosInvalidos({ nombre: 'es obligatorio' });
  const ref = rutas.obras(req.complejoId).doc();
  await ref.set({
    ...req.body, estado: req.body.estado ?? 'planificada',
    presupuestoAprobado: Math.round(Number(req.body.presupuestoAprobado ?? 0) * (req.body.presupuestoAprobadoCentavos ? 1 : 100)),
    gastoEjecutado: Math.round(Number(req.body.gastoEjecutado ?? 0) * (req.body.gastoEjecutadoCentavos ? 1 : 100)),
    fechaInicio: new Date(req.body.fechaInicio),
    creadoPorUid: req.usuario.uid, creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
  });
  res.status(201).json(aObjeto(await ref.get()));
}));

router.post('/:obraId/partidas', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  const ref = rutas.partidas(req.complejoId, req.params.obraId).doc();
  await ref.set({
    nombre: req.body.nombre, duracionEstimada: Number(req.body.duracionEstimada),
    predecesoras: req.body.predecesoras ?? [], presupuestoCentavos: Math.round(Number(req.body.presupuesto ?? 0) * 100),
    avancePorcentaje: 0, creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
  });
  const cronograma = await recalcularCronograma({ complejoId: req.complejoId, obraId: req.params.obraId });
  res.status(201).json({ partida: aObjeto(await ref.get()), cronograma });
}));

router.post('/:obraId/avances', exigirRol(ROLES.RESPONSABLE_OBRA, ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  exigirObraAsignada(req);
  res.status(201).json(await registrarAvance({
    complejoId: req.complejoId, obraId: req.params.obraId, autorUid: req.usuario.uid,
    partidaId: req.body.partidaId, porcentaje: Number(req.body.porcentaje), fotoUrl: req.body.fotoUrl,
    coordenadas: req.body.coordenadas, observacion: req.body.observacion,
    idempotencyKey: req.body.idempotencyKey, timestampCliente: req.body.timestampCliente,
  }));
}));

router.post('/:obraId/sincronizar', exigirRol(ROLES.RESPONSABLE_OBRA, ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  exigirObraAsignada(req);
  res.json(await sincronizarCola({ complejoId: req.complejoId, obraId: req.params.obraId, avances: req.body.avances ?? [], autorUid: req.usuario.uid }));
}));

router.post('/:obraId/recalcular', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  res.json(await recalcularCronograma({ complejoId: req.complejoId, obraId: req.params.obraId }));
}));

function exigirObraAsignada(req) {
  if (req.usuario.rol === ROLES.RESPONSABLE_OBRA && !req.usuario.obraIds.includes(req.params.obraId)) {
    throw errores.sinPermiso('No estás asignado a esta obra.');
  }
}

export default router;

