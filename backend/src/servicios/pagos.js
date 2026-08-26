/**
 * Servicio de pagos: checkout de Mercado Pago e imputacion.
 *
 * El punto delicado es el webhook. Mercado Pago avisa "paso algo con el pago
 * 123" y puede avisarlo VARIAS VECES por el mismo pago (reintentos, cambios de
 * estado, reenvios manuales desde el panel de MP). Si cada aviso imputara el
 * pago, una expensa quedaria pagada tres veces.
 *
 * La solucion es la misma idea que se usa en el modulo de obras: idempotencia.
 * El documento del pago se crea con el ID DE MERCADO PAGO como id de documento,
 * y la imputacion ocurre dentro de una transaccion que primero chequea si ese
 * pago ya fue procesado. El segundo aviso no hace nada y devuelve 200, que es
 * lo que Mercado Pago necesita para dejar de reintentar.
 */

import { db, rutas, FieldValue, aObjeto } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';
import { log } from '../infra/log.js';
import { imputarPago } from '../dominio/imputacion.js';
import { formatearPesos } from '../dominio/dinero.js';
import { crearPreferencia, consultarPago, armarReferencia, leerReferencia } from '../externos/mercadopago.js';
import { estadoDeCuenta } from './liquidacion.js';
import { enviarATokens, avisos } from '../externos/notificaciones.js';

const aFecha = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : new Date());

/**
 * Genera el link de pago de una unidad.
 * El monto lo calcula el backend a partir del estado de cuenta: el cliente
 * nunca manda cuanto quiere pagar de su propia expensa.
 */
export async function generarLinkDePago({ complejoId, unidadId, periodoId = null, email = null }) {
  const cuenta = await estadoDeCuenta({ complejoId, unidadId });

  const objetivo = periodoId
    ? cuenta.liquidaciones.find((l) => l.periodoId === periodoId)
    : cuenta.proximoVencimiento;

  if (!objetivo) {
    throw errores.reglaDeNegocio(
      'NADA_QUE_PAGAR',
      'No hay ningun periodo pendiente de pago para esta unidad.',
      null,
      'Si esperabas una liquidacion, revisá que la administracion haya cerrado el periodo.'
    );
  }
  if (objetivo.saldoPendiente <= 0) {
    throw errores.reglaDeNegocio('YA_PAGADO', 'Ese periodo ya esta pagado.');
  }

  const unidad = aObjeto(await rutas.unidad(complejoId, unidadId).get());
  const complejo = aObjeto(await rutas.complejo(complejoId).get());
  const nomenclatura = (complejo?.nomenclaturaAporte ?? 'expensa');
  const concepto = `${nomenclatura[0].toUpperCase()}${nomenclatura.slice(1)} ${objetivo.etiqueta} - ` +
                   `${unidad?.identificador ?? unidadId}`;

  const preferencia = await crearPreferencia({
    referencia: armarReferencia({ complejoId, unidadId, periodoId: objetivo.periodoId }),
    concepto,
    montoCentavos: objetivo.saldoPendiente,
    pagador: { email },
  });

  return {
    ...preferencia,
    periodoId: objetivo.periodoId,
    montoCentavos: objetivo.saldoPendiente,
    montoFormateado: formatearPesos(objetivo.saldoPendiente),
    concepto,
  };
}

/**
 * Procesa la notificacion de un pago.
 *
 * @param {object} entrada
 * @param {string} entrada.pagoId   Id del pago en Mercado Pago.
 * @param {object} [entrada.simulado] Datos del pago cuando corre en modo simulado.
 */
export async function procesarPago({ pagoId, simulado = null }) {
  const pago = simulado ?? await consultarPago(pagoId);

  if (pago.estado !== 'approved') {
    log.info('Pago no aprobado, no se imputa', { pagoId, estado: pago.estado });
    return { procesado: false, motivo: `estado_${pago.estado}` };
  }

  const referencia = leerReferencia(pago.referencia);
  if (!referencia) {
    log.aviso('Pago sin referencia valida', { pagoId, referencia: pago.referencia });
    return { procesado: false, motivo: 'referencia_invalida' };
  }

  const { complejoId, unidadId, periodoId } = referencia;
  const montoCentavos = pago.montoCentavos;
  if (!montoCentavos || montoCentavos <= 0) {
    return { procesado: false, motivo: 'monto_invalido' };
  }

  // El id de Mercado Pago ES el id del documento: dos avisos del mismo pago
  // apuntan al mismo documento y la transaccion descarta el segundo.
  const refPago = rutas.pagos(complejoId).doc(String(pagoId));

  const cuenta = await estadoDeCuenta({ complejoId, unidadId });
  const deudas = cuenta.deudas.map((d) => ({
    periodoId: d.periodoId,
    vencimiento: d.vencimiento,
    capitalCentavos: d.saldoCentavos,
    interesesCentavos: 0,
  }));

  // Los intereses se imputan primero: se agregan como concepto propio del
  // periodo mas viejo, que es donde estan devengados.
  if (cuenta.interesesAcumulados > 0 && deudas.length > 0) {
    deudas[0].interesesCentavos = cuenta.interesesAcumulados;
  }

  const imputacion = deudas.length > 0
    ? imputarPago({ montoCentavos, deudas })
    : { aIntereses: 0, aCapital: 0, aSaldoFuturo: montoCentavos, aplicaciones: [], periodos: [], deudaRestante: 0, cancelaTodo: true };

  const resultado = await db.runTransaction(async (tx) => {
    const yaExiste = await tx.get(refPago);
    if (yaExiste.exists) {
      return { duplicado: true, pagoId: String(pagoId) };
    }

    tx.set(refPago, {
      unidadId, periodoId,
      monto: montoCentavos,
      medio: pago.medio ?? 'mercadopago',
      tipoMedio: pago.tipoMedio ?? null,
      idPagoMercadoPago: String(pagoId),
      estado: 'acreditado',
      imputacion: {
        aIntereses: imputacion.aIntereses,
        aCapital: imputacion.aCapital,
        aSaldoFuturo: imputacion.aSaldoFuturo,
        aplicaciones: imputacion.aplicaciones,
      },
      fechaPago: aFecha(pago.fecha),
      creadoEn: FieldValue.serverTimestamp(),
      simulado: Boolean(pago.simulado),
    });

    // Se actualiza el saldo de cada periodo tocado por la imputacion.
    for (const p of imputacion.periodos) {
      const refDetalle = rutas.detalle(complejoId, p.periodoId).doc(unidadId);
      tx.update(refDetalle, {
        saldoPendiente: p.capitalRestante + p.interesesRestantes,
        pagado: p.cancelado,
        ultimoPagoEn: FieldValue.serverTimestamp(),
      });
    }

    // El excedente queda como saldo a favor en la unidad.
    if (imputacion.aSaldoFuturo > 0) {
      tx.update(rutas.unidad(complejoId, unidadId), {
        saldoAFavor: FieldValue.increment(imputacion.aSaldoFuturo),
        actualizadoEn: FieldValue.serverTimestamp(),
      });
    }

    return { duplicado: false, pagoId: String(pagoId) };
  });

  if (resultado.duplicado) {
    log.info('Aviso de pago duplicado, se descarta', { pagoId });
    return { procesado: false, motivo: 'duplicado', idempotente: true };
  }

  log.info('Pago imputado', {
    complejoId, unidadId, pagoId, monto: montoCentavos,
    aIntereses: imputacion.aIntereses, aCapital: imputacion.aCapital,
  });

  avisarAlResidente({ complejoId, unidadId, montoCentavos, periodoId }).catch(() => {});

  return {
    procesado: true,
    pagoId: String(pagoId),
    montoCentavos,
    imputacion,
  };
}

/** El aviso no puede hacer fallar la imputacion: se dispara aparte. */
async function avisarAlResidente({ complejoId, unidadId, montoCentavos, periodoId }) {
  const usuarios = await rutas.usuarios()
    .where('complejoId', '==', complejoId)
    .where('unidadId', '==', unidadId)
    .get();

  const tokens = usuarios.docs.map((d) => d.data().tokenFcm).filter(Boolean);
  if (tokens.length === 0) return;

  const aviso = avisos.pagoAcreditado({ monto: formatearPesos(montoCentavos), periodo: periodoId });
  await enviarATokens({ tokens, ...aviso, datos: { tipo: 'pago', periodoId } });
}

/** Registra un pago hecho fuera del sistema (transferencia, efectivo en la administracion). */
export async function registrarPagoManual({ complejoId, unidadId, periodoId, montoCentavos, medio, adminUid, observacion }) {
  const idManual = `manual-${Date.now()}-${unidadId}`;
  return procesarPago({
    pagoId: idManual,
    simulado: {
      id: idManual,
      estado: 'approved',
      montoCentavos,
      referencia: armarReferencia({ complejoId, unidadId, periodoId }),
      medio: medio ?? 'transferencia',
      fecha: new Date().toISOString(),
      simulado: false,
      registradoPorUid: adminUid,
      observacion,
    },
  });
}
