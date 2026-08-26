import { Router } from 'express';

import { asincrono, errores } from '../infra/errores.js';
import { autenticar, exigirRol, ROLES } from '../middleware/autenticar.js';
import { crearComplejo, actualizarComplejo, obtenerComplejo, listarComplejos } from '../servicios/complejos.js';

const router = Router();
router.use(autenticar);

router.get('/', asincrono(async (req, res) => {
  const ids = req.usuario.rol === ROLES.SUPERADMIN ? req.usuario.complejos : [req.usuario.complejoId];
  res.json(await listarComplejos(ids));
}));

router.post('/', exigirRol(ROLES.SUPERADMIN), asincrono(async (req, res) => {
  const complejo = await crearComplejo({ datos: req.body, actorUid: req.usuario.uid });
  res.status(201).json(complejo);
}));

router.get('/:complejoId', asincrono(async (req, res) => {
  exigirAcceso(req);
  res.json(await obtenerComplejo(req.params.complejoId));
}));

router.patch('/:complejoId/configuracion', exigirRol(ROLES.SUPERADMIN, ROLES.ADMIN), asincrono(async (req, res) => {
  exigirAcceso(req);
  const permitidos = [
    'nombre', 'tipo', 'tipoUnidad', 'nomenclaturaAporte', 'metodosAcceso', 'modulosActivos',
    'politicaRedondeo', 'porcentajeFondoReserva', 'tasaMoraMensual', 'modoMora',
    'diasGraciaMora', 'zonaHoraria', 'puntosAcceso', 'direccion', 'coordenadas',
  ];
  const cambios = Object.fromEntries(Object.entries(req.body ?? {}).filter(([k]) => permitidos.includes(k)));
  if (Object.keys(cambios).length === 0) throw errores.datosInvalidos({ configuracion: 'no contiene campos editables' });
  res.json(await actualizarComplejo({ complejoId: req.params.complejoId, cambios, actorUid: req.usuario.uid }));
}));

function exigirAcceso(req) {
  const cid = req.params.complejoId;
  const permitido = req.usuario.complejoId === cid ||
    (req.usuario.rol === ROLES.SUPERADMIN && req.usuario.complejos.includes(cid));
  if (!permitido) throw errores.sinPermiso('No tenés acceso a este complejo.');
}

export default router;

