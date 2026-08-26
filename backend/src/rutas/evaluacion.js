import { Router } from 'express';

import { rutas, FieldValue } from '../infra/firebase.js';
import { asincrono, errores } from '../infra/errores.js';
import { autenticar, exigirComplejo, exigirRol, ROLES } from '../middleware/autenticar.js';
import { evaluarCandidato } from '../servicios/evaluacion.js';

const router = Router({ mergeParams: true });
router.use(autenticar, exigirComplejo, exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN));

router.post('/', asincrono(async (req, res) => {
  if (!req.body?.nombre || Number(req.body?.ingresoMensual) <= 0 || Number(req.body?.expensaMensual) <= 0) {
    throw errores.datosInvalidos({ candidato: 'necesita nombre, ingreso y expensa válidos' });
  }
  res.status(201).json(await evaluarCandidato({ complejoId: req.complejoId, datos: req.body, actorUid: req.usuario.uid }));
}));

router.patch('/:candidatoId/estado', asincrono(async (req, res) => {
  if (!['evaluando', 'aprobado', 'rechazado'].includes(req.body?.estado)) throw errores.datosInvalidos({ estado: 'no es válido' });
  await rutas.candidatos(req.complejoId).doc(req.params.candidatoId).update({
    estado: req.body.estado, decididoPorUid: req.usuario.uid, decididoEn: FieldValue.serverTimestamp(),
  });
  res.json({ id: req.params.candidatoId, estado: req.body.estado });
}));

export default router;

