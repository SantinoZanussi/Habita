/** Amenities configurables y reservas con control transaccional de cupo. */

import { db, rutas, FieldValue, aObjeto, aLista, sello, selloCreacion } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';

export const ESTADOS_RESERVA_ACTIVOS = Object.freeze(['confirmada', 'pendiente']);

function fechaReserva(valor) {
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

export async function guardarAmenity({ complejoId, amenityId = null, datos, actorUid }) {
  const ref = amenityId ? rutas.amenities(complejoId).doc(amenityId) : rutas.amenities(complejoId).doc();
  const existe = (await ref.get()).exists;
  await ref.set({
    ...datos,
    capacidad: Number(datos.capacidad),
    activo: datos.activo ?? true,
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
    const propia = existentes.find((reserva) => reserva.unidadId === unidadId);
    if (propia) {
      throw errores.conflicto('Tu unidad ya tiene una reserva superpuesta para ese espacio y horario.', {
        reservaId: propia.id,
      });
    }
    const ocupacion = existentes.reduce((suma, r) => suma + Number(r.asistentes ?? 1), 0);
    if (ocupacion + cantidad > capacidad) {
      throw errores.conflicto('Ese horario ya no tiene cupo disponible.', {
        capacidad, ocupacion, solicitados: cantidad, disponibles: Math.max(0, capacidad - ocupacion),
      });
    }

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
  const reserva = aObjeto(await ref.get());
  if (!reserva) throw errores.noEncontrado('La reserva');
  if (unidadId && reserva.unidadId !== unidadId) throw errores.sinPermiso('Solo podes cancelar reservas de tu unidad.');
  await ref.update({ estado: 'cancelada', canceladaEn: FieldValue.serverTimestamp(), canceladaPorUid: actorUid });
  return { id: reservaId, estado: 'cancelada' };
}
