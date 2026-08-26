import { Router } from 'express';

import { asincrono, errores } from '../infra/errores.js';
import { autenticar, exigirComplejo, exigirRol, ROLES } from '../middleware/autenticar.js';
import { guardarAmenity, reservarAmenity, cancelarReserva } from '../servicios/amenities.js';

const router = Router({ mergeParams: true });
router.use(autenticar, exigirComplejo);

router.post('/', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  validarAmenity(req.body);
  res.status(201).json(await guardarAmenity({ complejoId: req.complejoId, datos: req.body, actorUid: req.usuario.uid }));
}));

router.patch('/:amenityId', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  res.json(await guardarAmenity({ complejoId: req.complejoId, amenityId: req.params.amenityId, datos: req.body, actorUid: req.usuario.uid }));
}));

router.post('/:amenityId/reservas', exigirRol(ROLES.RESIDENTE, ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  const unidadId = req.usuario.rol === ROLES.RESIDENTE ? req.usuario.unidadId : req.body.unidadId;
  res.status(201).json(await reservarAmenity({
    complejoId: req.complejoId, amenityId: req.params.amenityId, unidadId,
    desde: req.body.desde, hasta: req.body.hasta, asistentes: Number(req.body.asistentes ?? 1), actorUid: req.usuario.uid,
  }));
}));

router.delete('/reservas/:reservaId', asincrono(async (req, res) => {
  const unidadId = req.usuario.rol === ROLES.RESIDENTE ? req.usuario.unidadId : null;
  res.json(await cancelarReserva({ complejoId: req.complejoId, reservaId: req.params.reservaId, actorUid: req.usuario.uid, unidadId }));
}));

function validarAmenity(datos) {
  if (String(datos?.nombre ?? '').trim().length < 2 || Number(datos?.capacidad) < 1) {
    throw errores.datosInvalidos({ nombre: 'es obligatorio', capacidad: 'debe ser mayor a cero' });
  }
}

export default router;

