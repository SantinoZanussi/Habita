import { Router } from 'express';

import { rutas, aObjeto } from '../infra/firebase.js';
import { asincrono, errores } from '../infra/errores.js';
import { autenticar, exigirRol, ROLES } from '../middleware/autenticar.js';
import { crearUsuario, asignarRol } from '../servicios/usuarios.js';

const router = Router();
router.use(autenticar);

router.get('/me', asincrono(async (req, res) => {
  const perfil = aObjeto(await rutas.usuario(req.usuario.uid).get());
  res.json({ ...perfil, claims: req.usuario });
}));

router.post('/', exigirRol(ROLES.SUPERADMIN, ROLES.ADMIN), asincrono(async (req, res) => {
  validarGestion(req, req.body?.rol, req.body?.complejoId);
  const resultado = await crearUsuario(req.body);
  res.status(201).json(resultado);
}));

router.put('/:uid/rol', exigirRol(ROLES.SUPERADMIN, ROLES.ADMIN), asincrono(async (req, res) => {
  validarGestion(req, req.body?.rol, req.body?.complejoId);
  const resultado = await asignarRol({ uid: req.params.uid, ...req.body });
  res.json(resultado);
}));

function validarGestion(req, rol, complejoId) {
  if (req.usuario.rol === ROLES.ADMIN) {
    if (complejoId !== req.usuario.complejoId) throw errores.sinPermiso('Solo podés gestionar usuarios de tu complejo.');
    if (![ROLES.RESIDENTE, ROLES.GUARDIA, ROLES.RESPONSABLE_OBRA].includes(rol)) {
      throw errores.sinPermiso('Un administrador de complejo no puede crear otros administradores.');
    }
  }
  if (req.usuario.rol === ROLES.SUPERADMIN && complejoId && !req.usuario.complejos.includes(complejoId)) {
    throw errores.sinPermiso('Ese complejo no pertenece a tu cartera.');
  }
}

export default router;

