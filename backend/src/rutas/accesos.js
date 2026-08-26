import { randomBytes } from 'node:crypto';
import { Router } from 'express';

import { rutas, FieldValue, aObjeto } from '../infra/firebase.js';
import { asincrono, errores } from '../infra/errores.js';
import { autenticar, exigirComplejo, exigirRol, ROLES } from '../middleware/autenticar.js';
import { entorno } from '../config/entorno.js';
import { generarCodigoDinamico } from '../dominio/accesos.js';
import { validarAcceso, ultimosEventos, quienEstaAdentro, SENTIDOS } from '../servicios/accesos.js';

const router = Router({ mergeParams: true });
router.use(autenticar, exigirComplejo);

router.post('/validar', exigirRol(ROLES.GUARDIA, ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  if (!req.body?.punto) throw errores.datosInvalidos({ punto: 'es obligatorio' });
  if (req.body?.sentido && !SENTIDOS.includes(req.body.sentido)) throw errores.datosInvalidos({ sentido: 'no es válido' });
  const resultado = await validarAcceso({
    complejoId: req.complejoId,
    guardiaUid: req.usuario.uid,
    codigo: req.body.codigo,
    patente: req.body.patente,
    punto: req.body.punto,
    sentido: req.body.sentido ?? 'ingreso',
    fotoUrl: req.body.fotoUrl ?? null,
  });
  // Una credencial rechazada no es un error HTTP: es un resultado esperado del
  // control de acceso y la guardia necesita ver el motivo en la misma pantalla.
  res.status(200).json(resultado);
}));

router.get('/eventos', exigirRol(ROLES.GUARDIA, ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  res.json(await ultimosEventos(req.complejoId, { limite: Math.min(200, Number(req.query.limite ?? 50)), punto: req.query.punto ?? null }));
}));

router.get('/presentes', exigirRol(ROLES.GUARDIA, ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  res.json(await quienEstaAdentro(req.complejoId));
}));

router.post('/qr-dinamico', exigirRol(ROLES.RESIDENTE), (req, res) => {
  const codigo = generarCodigoDinamico({
    secreto: entorno.secretoQr,
    sujeto: req.usuario.uid,
    complejoId: req.complejoId,
  });
  res.json({ codigo, venceEnSegundos: 60, generadoEn: new Date().toISOString() });
});

router.post('/autorizaciones', exigirRol(ROLES.RESIDENTE, ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  const unidadId = req.usuario.rol === ROLES.RESIDENTE ? req.usuario.unidadId : req.body.unidadId;
  if (!unidadId || String(req.body?.nombre ?? '').trim().length < 2) {
    throw errores.datosInvalidos({ unidadId: 'es obligatoria', nombre: 'es obligatorio' });
  }
  const desde = new Date(req.body.vigenciaDesde ?? Date.now());
  const hasta = new Date(req.body.vigenciaHasta);
  if (Number.isNaN(hasta.getTime()) || hasta <= desde) throw errores.datosInvalidos({ vigenciaHasta: 'debe ser posterior al inicio' });
  const ref = rutas.autorizaciones(req.complejoId).doc();
  const codigoQr = `HBA-${randomBytes(12).toString('base64url')}`;
  await ref.set({
    tipo: req.body.tipo ?? 'visita',
    nombre: String(req.body.nombre).trim(),
    documento: req.body.documento ?? null,
    patente: req.body.patente ?? null,
    patenteNormalizada: req.body.patente ? String(req.body.patente).toUpperCase().replace(/[^A-Z0-9]/g, '') : null,
    unidadId,
    autorizadoPorUid: req.usuario.uid,
    vigenciaDesde: desde,
    vigenciaHasta: hasta,
    diasPermitidos: req.body.diasPermitidos ?? [0, 1, 2, 3, 4, 5, 6],
    franjaHoraria: req.body.franjaHoraria ?? null,
    puntosPermitidos: req.body.puntosPermitidos ?? [],
    usosPermitidos: Math.min(10, Math.max(1, Number(req.body.usosPermitidos ?? 1))),
    usosConsumidos: 0,
    codigoQr,
    estado: 'vigente',
    creadoEn: FieldValue.serverTimestamp(),
    actualizadoEn: FieldValue.serverTimestamp(),
  });
  res.status(201).json(aObjeto(await ref.get()));
}));

router.patch('/autorizaciones/:autorizacionId/revocar', asincrono(async (req, res) => {
  const ref = rutas.autorizacion(req.complejoId, req.params.autorizacionId);
  const autorizacion = aObjeto(await ref.get());
  if (!autorizacion) throw errores.noEncontrado('La autorización');
  const admin = [ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.usuario.rol);
  if (!admin && autorizacion.unidadId !== req.usuario.unidadId) throw errores.sinPermiso('No podés revocar esta autorización.');
  await ref.update({ estado: 'revocada', actualizadoEn: FieldValue.serverTimestamp(), revocadaPorUid: req.usuario.uid });
  res.json({ id: ref.id, estado: 'revocada' });
}));

export default router;
