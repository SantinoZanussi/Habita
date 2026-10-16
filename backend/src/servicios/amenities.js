/** Amenities configurables y reservas con control transaccional de cupo. */

import { db, rutas, FieldValue, aObjeto, aLista, sello, selloCreacion } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';

export const ESTADOS_RESERVA_ACTIVOS = Object.freeze(['confirmada', 'pendiente']);

function fechaReserva(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor?.toDate && typeof valor.toDate === 'function') return valor.toDate();
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function reservasSuperpuestas(reservas, inicio, fin) {
  return reservas.filter((reserva) => {
    if (!ESTADOS_RESERVA_ACTIVOS.includes(reserva.estado)) return false;
    const desde = fechaReserva(reserva.desde);
    const hasta = fechaReserva(reserva.hasta);
    return desde && hasta && desde < fin && hasta > inicio;
  });
}

export function validarIntervaloReserva({ desde, hasta, asistentes = 1 }) {
  const inicio = fechaReserva(desde);
  const fin = fechaReserva(hasta);
  const cantidad = Number(asistentes);
  if (!inicio || !fin) {
    throw errores.datosInvalidos({ desde: 'usá una fecha válida', hasta: 'usá una fecha válida' });
  }
  if (fin <= inicio) throw errores.datosInvalidos({ hasta: 'tiene que ser posterior al inicio' });
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw errores.datosInvalidos({ asistentes: 'tiene que ser un entero mayor a cero' });
  }
  return { inicio, fin, cantidad };
}

export function validarHorarioAmenity(amenity, inicio, fin, ahora = new Date()) {
  if (inicio < ahora) throw errores.datosInvalidos({ desde: 'no se puede reservar en el pasado' });
  if (amenity.anticipacionMaximaDias > 0 && inicio - ahora > amenity.anticipacionMaximaDias * 86400000) {
    throw errores.datosInvalidos({ desde: `la anticipación máxima es ${amenity.anticipacionMaximaDias} días` });
  }
  if (!amenity.horarios?.length) return;
  const partes = (fecha) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(fecha).map(({ type, value }) => [type, value]));
  const desde = partes(inicio), hasta = partes(fin);
  const dia = (p) => Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
  const minutos = (texto) => { const [h, m] = texto.split(':').map(Number); return h * 60 + m; };
  const i = minutos(`${desde.hour}:${desde.minute}`);
  const f = minutos(`${hasta.hour}:${hasta.minute}`) + (dia(hasta) - dia(desde)) / 60000;
  if (!amenity.horarios.some((h) => {
    const apertura = minutos(h.desde);
    let cierre = minutos(h.hasta);
    if (cierre <= apertura) cierre += 1440;
    return [0, -1440].some((offset) => i >= apertura + offset && f <= cierre + offset);
  })) {
    throw errores.datosInvalidos({ horario: 'elegí un intervalo dentro del horario del espacio' });
  }
}

export async function guardarAmenity({ complejoId, amenityId = null, datos, actorUid }) {
  const ref = amenityId ? rutas.amenities(complejoId).doc(amenityId) : rutas.amenities(complejoId).doc();
  const existe = (await ref.get()).exists;
  if (amenityId && !existe) throw errores.noEncontrado('El amenity');
  const cambios = Object.fromEntries(Object.entries(datos).filter(([clave]) =>
    ['nombre', 'capacidad', 'activo', 'requiereAprobacion', 'anticipacionMaximaDias', 'horarios', 'descripcion', 'tipo'].includes(clave)));
  if (cambios.nombre !== undefined && String(cambios.nombre).trim().length < 2) throw errores.datosInvalidos({ nombre: 'es obligatorio' });
  if (cambios.capacidad !== undefined) {
    cambios.capacidad = Number(cambios.capacidad);
    if (!Number.isSafeInteger(cambios.capacidad) || cambios.capacidad < 1) throw errores.datosInvalidos({ capacidad: 'debe ser un entero positivo' });
  }
  if (cambios.anticipacionMaximaDias !== undefined && (!Number.isSafeInteger(cambios.anticipacionMaximaDias) || cambios.anticipacionMaximaDias < 1)) {
    throw errores.datosInvalidos({ anticipacionMaximaDias: 'debe ser un entero positivo' });
  }
  for (const clave of ['activo', 'requiereAprobacion']) {
    if (cambios[clave] !== undefined && typeof cambios[clave] !== 'boolean') throw errores.datosInvalidos({ [clave]: 'debe ser verdadero o falso' });
  }
  if (cambios.horarios !== undefined && (!Array.isArray(cambios.horarios) || cambios.horarios.some((h) =>
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(h?.desde) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h?.hasta)))) {
    throw errores.datosInvalidos({ horarios: 'indicá franjas desde/hasta con formato HH:mm' });
  }
  await ref.set({
    ...cambios,
    ...(!existe ? { activo: cambios.activo ?? true } : {}),
    ...(existe ? sello(actorUid) : selloCreacion(actorUid)),
  }, { merge: true });
  return aObjeto(await ref.get());
}

export async function reservarAmenity({ complejoId, amenityId, unidadId, desde, hasta, asistentes = 1, actorUid }) {
  const refAmenity = rutas.amenities(complejoId).doc(amenityId);
  const refReserva = rutas.reservas(complejoId).doc();
  const { inicio, fin, cantidad } = validarIntervaloReserva({ desde, hasta, asistentes });
  if (!unidadId) throw errores.datosInvalidos({ unidadId: 'es obligatoria' });

  return db.runTransaction(async (tx) => {
    const amenity = aObjeto(await tx.get(refAmenity));
    if (!amenity || amenity.activo === false) throw errores.noEncontrado('El amenity');
    validarHorarioAmenity(amenity, inicio, fin);
    const capacidad = Number(amenity.capacidad);
    if (!Number.isInteger(capacidad) || capacidad < 1) {
      throw errores.reglaDeNegocio('AMENITY_SIN_CAPACIDAD', 'El amenity no tiene una capacidad válida.');
    }
    if (cantidad > capacidad) {
      throw errores.conflicto('La cantidad de asistentes supera la capacidad del amenity.', {
        capacidad, solicitados: cantidad,
      });
    }

    const consulta = rutas.reservas(complejoId)
      .where('amenityId', '==', amenityId)
      .where('estado', 'in', ESTADOS_RESERVA_ACTIVOS);
    const existentes = reservasSuperpuestas(aLista(await tx.get(consulta)), inicio, fin);
    const propias = existentes.filter((reserva) => reserva.unidadId === unidadId);
    const asistentesPropios = propias.reduce((suma, r) => suma + Number(r.asistentes ?? 1), 0);
    
    const unidadSnap = await tx.get(rutas.unidad(complejoId, unidadId));
    const unidad = aObjeto(unidadSnap);
    if (!unidad || unidad.estado === 'baja') throw errores.noEncontrado('La unidad');
    const habitantes = unidad?.habitantes ?? 4; // Por defecto 4 si no está configurado

    if (asistentesPropios + cantidad > habitantes) {
      throw errores.conflicto(`El grupo familiar superaría su límite de asistentes simultáneos (${habitantes}).`, {
        habitantes,
        solicitados: cantidad,
        yaReservados: asistentesPropios,
      });
    }
    const ocupacion = existentes.reduce((suma, r) => suma + Number(r.asistentes ?? 1), 0);
    if (ocupacion + cantidad > capacidad) {
      throw errores.conflicto('Ese horario ya no tiene cupo disponible.', {
        capacidad, ocupacion, solicitados: cantidad, disponibles: Math.max(0, capacidad - ocupacion),
      });
    }

    // Serializa también las consultas vacías: dos reservas nuevas deben
    // competir por el mismo documento aunque aún no haya reservas previas.
    tx.update(refAmenity, { revisionReservas: FieldValue.increment(1) });
    tx.set(refReserva, {
      amenityId,
      amenityNombre: amenity.nombre,
      unidadId,
      desde: inicio,
      hasta: fin,
      asistentes: cantidad,
      estado: amenity.requiereAprobacion ? 'pendiente' : 'confirmada',
      autorUid: actorUid,
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    return {
      id: refReserva.id,
      estado: amenity.requiereAprobacion ? 'pendiente' : 'confirmada',
      capacidad,
      ocupacion: ocupacion + cantidad,
      disponibles: Math.max(0, capacidad - ocupacion - cantidad),
    };
  });
}

export async function cancelarReserva({ complejoId, reservaId, actorUid, unidadId = null }) {
  const ref = rutas.reservas(complejoId).doc(reservaId);
  return db.runTransaction(async (tx) => {
  const reserva = aObjeto(await tx.get(ref));
  if (!reserva) throw errores.noEncontrado('La reserva');
  if (unidadId && reserva.unidadId !== unidadId) throw errores.sinPermiso('Solo podes cancelar reservas de tu unidad.');
  if (reserva.estado === 'cancelada') return { id: reservaId, estado: 'cancelada' };
  if (!ESTADOS_RESERVA_ACTIVOS.includes(reserva.estado)) throw errores.conflicto('La reserva ya no está activa.');
  tx.update(ref, { estado: 'cancelada', canceladaEn: FieldValue.serverTimestamp(), canceladaPorUid: actorUid });
  tx.update(rutas.amenities(complejoId).doc(reserva.amenityId), { revisionReservas: FieldValue.increment(1) });
  return { id: reservaId, estado: 'cancelada' };
  });
}

export async function resolverReserva({ complejoId, reservaId, estado, actorUid }) {
  if (!['confirmada', 'rechazada'].includes(estado)) {
    throw errores.datosInvalidos({ estado: 'usá confirmada o rechazada' });
  }
  const ref = rutas.reservas(complejoId).doc(reservaId);
  return db.runTransaction(async (tx) => {
  const reserva = aObjeto(await tx.get(ref));
  if (!reserva) throw errores.noEncontrado('La reserva');
  if (reserva.estado !== 'pendiente') {
    throw errores.conflicto('La reserva ya no está pendiente.', { estado: reserva.estado });
  }
  tx.update(ref, { estado, resueltaEn: FieldValue.serverTimestamp(), resueltaPorUid: actorUid });
  tx.update(rutas.amenities(complejoId).doc(reserva.amenityId), { revisionReservas: FieldValue.increment(1) });
  return { id: reservaId, estado };
  });
}

