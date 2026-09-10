import { Router } from 'express';

import { rutas, aObjeto } from '../infra/firebase.js';
import { asincrono } from '../infra/errores.js';
import { autenticar, exigirRol, ROLES } from '../middleware/autenticar.js';
import { crearUsuario, asignarRol } from '../servicios/usuarios.js';

const router = Router();
router.use(autenticar);

router.get('/me', asincrono(async (req, res) => {
  const perfil = aObjeto(await rutas.usuario(req.usuario.uid).get());
  res.json({ ...perfil, claims: req.usuario });
}));

router.post('/', exigirRol(ROLES.SUPERADMIN, ROLES.ADMIN), asincrono(async (req, res) => {
  const resultado = await crearUsuario(req.body, req.usuario);
  res.status(201).json(resultado);
}));

router.put('/:uid/rol', exigirRol(ROLES.SUPERADMIN, ROLES.ADMIN), asincrono(async (req, res) => {
  const resultado = await asignarRol({ ...req.body, uid: req.params.uid }, req.usuario);
  res.json(resultado);
}));

export default router;
