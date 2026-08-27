import { randomUUID } from 'node:crypto';
import { Router } from 'express';

import { rutas, FieldValue, aObjeto } from '../infra/firebase.js';
import { asincrono, errores } from '../infra/errores.js';
import { autenticar, exigirComplejo, exigirRol, exigirUnidadPropia, ROLES } from '../middleware/autenticar.js';
import { calcularBorrador, cerrarPeriodo, estadoDeCuenta, resumenCobranza } from '../servicios/liquidacion.js';
import { generarLinkDePago, procesarPago, registrarPagoManual } from '../servicios/pagos.js';
import { armarReferencia } from '../externos/mercadopago.js';

const router = Router({ mergeParams: true });
router.use(autenticar, exigirComplejo);

router.post('/periodos', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  const periodoId = String(req.body?.periodoId ?? '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodoId)) throw errores.datosInvalidos({ periodoId: 'debe tener formato AAAA-MM' });
  const ref = rutas.periodo(req.complejoId, periodoId);
  if ((await ref.get()).exists) throw errores.conflicto('Ese período ya existe.');
  const datos = normalizarPeriodo(req.body);
  await ref.set({ ...datos, estado: 'borrador', creadoPorUid: req.usuario.uid, creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp() });
  res.status(201).json(aObjeto(await ref.get()));
}));

router.patch('/periodos/:periodoId', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  const ref = rutas.periodo(req.complejoId, req.params.periodoId);
  const actual = aObjeto(await ref.get());
  if (!actual) throw errores.noEncontrado('El período');
  if (actual.estado === 'cerrado') throw errores.conflicto('Un período cerrado es inmutable; cargá un ajuste en el siguiente.');
  await ref.update({ ...normalizarPeriodo(req.body), actualizadoEn: FieldValue.serverTimestamp(), actualizadoPorUid: req.usuario.uid });
  res.json(aObjeto(await ref.get()));
}));

router.get('/periodos/:periodoId/borrador', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  res.json(await calcularBorrador({ complejoId: req.complejoId, periodoId: req.params.periodoId }));
}));

router.post('/periodos/:periodoId/cerrar', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  res.json(await cerrarPeriodo({ complejoId: req.complejoId, periodoId: req.params.periodoId, adminUid: req.usuario.uid }));
}));

router.get(
  '/cuenta/:unidadId',
  exigirRol(ROLES.RESIDENTE, ROLES.ADMIN, ROLES.SUPERADMIN),
  exigirUnidadPropia(),
  asincrono(async (req, res) => {
    res.json(await estadoDeCuenta({ complejoId: req.complejoId, unidadId: req.params.unidadId }));
  })
);

router.get('/resumen', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  res.json(await resumenCobranza({ complejoId: req.complejoId, periodoId: req.query.periodoId ?? null }));
}));

router.post('/pagar', exigirRol(ROLES.RESIDENTE), asincrono(async (req, res) => {
  res.json(await generarLinkDePago({
    complejoId: req.complejoId,
    unidadId: req.usuario.unidadId,
    periodoId: req.body.periodoId ?? null,
    email: req.usuario.email,
  }));
}));

router.post('/pagos/manual', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  const montoCentavos = Math.round(Number(req.body?.monto) * 100);
  if (!Number.isInteger(montoCentavos) || montoCentavos <= 0) throw errores.datosInvalidos({ monto: 'debe ser mayor a cero' });
  res.status(201).json(await registrarPagoManual({
    complejoId: req.complejoId,
    unidadId: req.body.unidadId,
    periodoId: req.body.periodoId,
    montoCentavos,
    medio: req.body.medio,
    observacion: req.body.observacion,
    adminUid: req.usuario.uid,
  }));
}));

// Confirma el checkout falso cuando no hay credenciales comerciales. La ruta
// conserva idempotencia y usa exactamente el mismo motor que el webhook real.
router.post('/pagos/simular', exigirRol(ROLES.RESIDENTE), asincrono(async (req, res) => {
  const cuenta = await estadoDeCuenta({ complejoId: req.complejoId, unidadId: req.usuario.unidadId });
  const periodoId = req.body.periodoId ?? cuenta.proximoVencimiento?.periodoId;
  const objetivo = cuenta.liquidaciones.find((l) => l.periodoId === periodoId);
  if (!objetivo || objetivo.saldoPendiente <= 0) throw errores.reglaDeNegocio('NADA_QUE_PAGAR', 'No hay saldo pendiente para ese período.');
  const pagoId = String(req.body.pagoId ?? `sim-${randomUUID()}`);
  res.json(await procesarPago({
    pagoId,
    simulado: {
      id: pagoId, estado: 'approved', montoCentavos: objetivo.saldoPendiente,
      referencia: armarReferencia({ complejoId: req.complejoId, unidadId: req.usuario.unidadId, periodoId }),
      medio: 'mercadopago_simulado', fecha: new Date().toISOString(), simulado: true,
    },
  }));
}));

function normalizarPeriodo(datos) {
  const salida = {};
  for (const clave of ['etiqueta', 'vencimiento', 'politicaRedondeo']) {
    if (datos?.[clave] !== undefined) salida[clave] = clave === 'vencimiento' ? new Date(datos[clave]) : datos[clave];
  }
  if (datos?.fondoReserva !== undefined) salida.fondoReserva = datos.fondoReserva;
  if (datos?.gastosOrdinarios !== undefined) salida.gastosOrdinarios = normalizarGastos(datos.gastosOrdinarios, 'ocupante');
  if (datos?.gastosExtraordinarios !== undefined) salida.gastosExtraordinarios = normalizarGastos(datos.gastosExtraordinarios, 'propietario');
  return salida;
}

function normalizarGastos(gastos, cargoDefault) {
  if (!Array.isArray(gastos)) throw errores.datosInvalidos({ gastos: 'deben ser una lista' });
  return gastos.map((g) => {
    const montoCentavos = Number.isInteger(g.montoCentavos) ? g.montoCentavos : Math.round(Number(g.monto) * 100);
    if (!g.concepto || !Number.isInteger(montoCentavos) || montoCentavos < 0) throw errores.datosInvalidos({ gasto: 'cada gasto necesita concepto y monto válido' });
    return {
      id: g.id ?? randomUUID(), concepto: String(g.concepto).trim(), montoCentavos,
      criterio: g.criterio ?? 'coeficiente', aCargoDe: g.aCargoDe ?? cargoDefault,
      obraId: g.obraId ?? null,
    };
  });
}

export default router;

