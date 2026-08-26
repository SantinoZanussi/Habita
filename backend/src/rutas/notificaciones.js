import { Router } from 'express';

import { asincrono } from '../infra/errores.js';
import { autenticar, exigirComplejo, exigirRol, ROLES } from '../middleware/autenticar.js';
import { publicarAviso } from '../servicios/notificaciones.js';

const router = Router({ mergeParams: true });
router.use(autenticar, exigirComplejo, exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN));

router.post('/', asincrono(async (req, res) => {
  res.status(201).json(await publicarAviso({
    complejoId: req.complejoId, titulo: req.body.titulo, cuerpo: req.body.cuerpo,
    tipo: req.body.tipo, destinatarios: req.body.destinatarios ?? 'todos', actorUid: req.usuario.uid,
  }));
}));

export default router;

