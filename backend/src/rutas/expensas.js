import { randomUUID } from 'node:crypto';
import { Router } from 'express';

import { db, rutas, FieldValue, aObjeto } from '../infra/firebase.js';
import { asincrono, errores } from '../infra/errores.js';
import { autenticar, exigirComplejo, exigirRol, exigirUnidadPropia, ROLES } from '../middleware/autenticar.js';
import { calcularBorrador, cerrarPeriodo, estadoDeCuenta, resumenCobranza } from '../servicios/liquidacion.js';
import { generarLinkDePago, procesarPago, registrarPagoManual } from '../servicios/pagos.js';
import { armarReferencia } from '../externos/mercadopago.js';
import { exigirPagoSimulado } from '../middleware/pagos.js';

const router = Router({ mergeParams: true });
router.use(autenticar, exigirComplejo);

router.post('/periodos', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  const periodoId = String(req.body?.periodoId ?? '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodoId)) throw errores.datosInvalidos({ periodoId: 'debe tener formato AAAA-MM' });
  const ref = rutas.periodo(req.complejoId, periodoId);
  const datos = normalizarPeriodo(req.body);
  if (!datos.vencimiento) throw errores.datosInvalidos({ vencimiento: 'es obligatorio' });
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) throw errores.conflicto('Ese período ya existe.');
    tx.set(ref, { ...datos, estado: 'borrador', creadoPorUid: req.usuario.uid, creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp() });
  });
  res.status(201).json(aObjeto(await ref.get()));
}));

router.patch('/periodos/:periodoId', exigirRol(ROLES.ADMIN, ROLES.SUPERADMIN), asincrono(async (req, res) => {
  const ref = rutas.periodo(req.complejoId, req.params.periodoId);
  const datos = normalizarPeriodo(req.body);
  await db.runTransaction(async (tx) => {
  const actual = aObjeto(await tx.get(ref));
  if (!actual) throw errores.noEncontrado('El período');
  if (actual.estado === 'cerrado') throw errores.conflicto('Un período cerrado es inmutable; cargá un ajuste en el siguiente.');
  tx.update(ref, { ...datos, actualizadoEn: FieldValue.serverTimestamp(), actualizadoPorUid: req.usuario.uid });
  });
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
  if (!Number.isSafeInteger(montoCentavos) || montoCentavos <= 0) throw errores.datosInvalidos({ monto: 'debe ser un importe válido mayor a cero' });
  for (const clave of ['unidadId', 'periodoId']) {
    if (typeof req.body[clave] !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(req.body[clave])) {
      throw errores.datosInvalidos({ [clave]: 'seleccioná un valor válido' });
    }
  }
  if (req.body.idempotencyKey !== undefined && !/^[A-Za-z0-9_-]{16,128}$/.test(req.body.idempotencyKey)) {
    throw errores.datosInvalidos({ idempotencyKey: 'identificador inválido' });
  }
  if (!['transferencia', 'efectivo', 'debito'].includes(req.body.medio ?? 'transferencia')) {
    throw errores.datosInvalidos({ medio: 'seleccioná transferencia, efectivo o débito' });
  }
  res.status(201).json(await registrarPagoManual({
    complejoId: req.complejoId,
    unidadId: req.body.unidadId,
    periodoId: req.body.periodoId,
    montoCentavos,
    medio: req.body.medio,
    observacion: req.body.observacion,
    idempotencyKey: req.body.idempotencyKey,
    adminUid: req.usuario.uid,
  }));
}));

// Confirma el checkout falso cuando no hay credenciales comerciales. La ruta
// conserva idempotencia y usa exactamente el mismo motor que el webhook real.
router.post('/pagos/simular', exigirRol(ROLES.RESIDENTE), exigirPagoSimulado, asincrono(async (req, res) => {
  const cuenta = await estadoDeCuenta({ complejoId: req.complejoId, unidadId: req.usuario.unidadId });
  const periodoId = req.body.periodoId ?? cuenta.proximoVencimiento?.periodoId;
  const objetivo = cuenta.liquidaciones.find((l) => l.periodoId === periodoId);
  if (!objetivo || objetivo.saldoPendiente <= 0) throw errores.reglaDeNegocio('NADA_QUE_PAGAR', 'No hay saldo pendiente para ese período.');
  const pagoId = String(req.body.pagoId ?? `sim-${randomUUID()}`);
  res.json(await procesarPago({
    pagoId,
    simulado: {
      id: pagoId, estado: 'approved', montoCentavos: req.body.periodoId ? objetivo.saldoPendiente : cuenta.totalAdeudado,
      referencia: armarReferencia({ complejoId: req.complejoId, unidadId: req.usuario.unidadId, periodoId }),
      medio: 'mercadopago_simulado', fecha: new Date().toISOString(), simulado: true,
    },
  }));
}));

export function normalizarPeriodo(datos) {
  const salida = {};
  for (const clave of ['etiqueta', 'vencimiento', 'politicaRedondeo']) {
    if (datos?.[clave] !== undefined) salida[clave] = clave === 'vencimiento' ? new Date(datos[clave]) : datos[clave];
  }
  if (salida.vencimiento && Number.isNaN(salida.vencimiento.getTime())) throw errores.datosInvalidos({ vencimiento: 'usá una fecha válida' });
  if (salida.politicaRedondeo && !['mayorResto', 'mayorCoeficiente'].includes(salida.politicaRedondeo)) throw errores.datosInvalidos({ politicaRedondeo: 'no es válida' });
  if (datos?.fondoReserva !== undefined) {
    const fondo = datos.fondoReserva;
    if (!['monto', 'porcentaje'].includes(fondo?.modo) || !Number.isFinite(fondo.valor) || fondo.valor < 0 ||
      (fondo.modo === 'monto' && !Number.isSafeInteger(fondo.valor)) || (fondo.modo === 'porcentaje' && fondo.valor > 100)) {
      throw errores.datosInvalidos({ fondoReserva: 'indicá monto en centavos o porcentaje entre 0 y 100' });
    }
    salida.fondoReserva = { modo: fondo.modo, valor: fondo.valor };
  }
  if (datos?.gastosOrdinarios !== undefined) salida.gastosOrdinarios = normalizarGastos(datos.gastosOrdinarios, 'ocupante');
  if (datos?.gastosExtraordinarios !== undefined) salida.gastosExtraordinarios = normalizarGastos(datos.gastosExtraordinarios, 'propietario');
  return salida;
}

function normalizarGastos(gastos, cargoDefault) {
  if (!Array.isArray(gastos)) throw errores.datosInvalidos({ gastos: 'deben ser una lista' });
  return gastos.map((g) => {
    const montoCentavos = Number.isInteger(g.montoCentavos) ? g.montoCentavos : Math.round(Number(g.monto) * 100);
    if (!String(g.concepto ?? '').trim() || !Number.isSafeInteger(montoCentavos) || montoCentavos < 0) throw errores.datosInvalidos({ gasto: 'cada gasto necesita concepto y monto válido' });
    if (!['coeficiente', 'partesIguales'].includes(g.criterio ?? 'coeficiente') || !['ocupante', 'propietario'].includes(g.aCargoDe ?? cargoDefault)) {
      throw errores.datosInvalidos({ gasto: 'criterio o responsable inválido' });
    }
    return {
      id: g.id ?? randomUUID(), concepto: String(g.concepto).trim(), montoCentavos,
      criterio: g.criterio ?? 'coeficiente', aCargoDe: g.aCargoDe ?? cargoDefault,
      obraId: g.obraId ?? null,
    };
  });
}

export default router;

