import { Router } from 'express';

import { asincrono, errores } from '../infra/errores.js';
import { autenticar, exigirComplejo, exigirRol, ROLES } from '../middleware/autenticar.js';
import { listarUnidades, crearUnidad, actualizarUnidad, darDeBajaUnidad, validarCoeficientesDelComplejo } from '../servicios/unidades.js';

const router = Router({ mergeParams: true });
router.use(autenticar, exigirComplejo, exigirRol(ROLES.SUPERADMIN, ROLES.ADMIN));

router.get('/', asincrono(async (req, res) => {
  res.json(await listarUnidades(req.complejoId, { incluirBajas: req.query.incluirBajas === 'true' }));
}));

router.get('/validacion-coeficientes', asincrono(async (req, res) => {
  res.json(await validarCoeficientesDelComplejo(req.complejoId));
}));

router.post('/', asincrono(async (req, res) => {
  validar(req.body);
  const unidad = await crearUnidad({ complejoId: req.complejoId, datos: req.body, actorUid: req.usuario.uid });
  res.status(201).json(unidad);
}));

router.patch('/:unidadId', asincrono(async (req, res) => {
  if (req.body?.coeficiente !== undefined && (Number(req.body.coeficiente) <= 0 || Number(req.body.coeficiente) > 100)) {
    throw errores.datosInvalidos({ coeficiente: 'debe estar entre 0 y 100' });
  }
  res.json(await actualizarUnidad({ complejoId: req.complejoId, unidadId: req.params.unidadId, cambios: req.body, actorUid: req.usuario.uid }));
}));

router.delete('/:unidadId', asincrono(async (req, res) => {
  res.json(await darDeBajaUnidad({ complejoId: req.complejoId, unidadId: req.params.unidadId, actorUid: req.usuario.uid }));
}));

function validar(datos) {
  const erroresCampos = {};
  if (String(datos?.identificador ?? '').trim().length < 1) erroresCampos.identificador = 'es obligatorio';
  if (!Number.isFinite(Number(datos?.coeficiente)) || Number(datos.coeficiente) <= 0 || Number(datos.coeficiente) > 100) {
    erroresCampos.coeficiente = 'debe estar entre 0 y 100';
  }
  if (Object.keys(erroresCampos).length) throw errores.datosInvalidos(erroresCampos);
}

export default router;

