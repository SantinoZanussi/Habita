/** Amenities configurables y reservas con control transaccional de cupo. */

import { db, rutas, FieldValue, aObjeto, aLista, sello, selloCreacion } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';

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
  const inicio = new Date(desde);
  const fin = new Date(hasta);
  if (fin <= inicio) throw errores.datosInvalidos({ hasta: 'tiene que ser posterior al inicio' });

  return db.runTransaction(async (tx) => {
    const amenity = aObjeto(await tx.get(refAmenity));
    if (!amenity || amenity.activo === false) throw errores.noEncontrado('El amenity');

    const consulta = rutas.reservas(complejoId)
      .where('amenityId', '==', amenityId)
      .where('estado', '==', 'confirmada');
    const existentes = aLista(await tx.get(consulta)).filter((r) => {
      const rDesde = r.desde?.toDate?.() ?? new Date(r.desde);
      const rHasta = r.hasta?.toDate?.() ?? new Date(r.hasta);
      return rDesde < fin && rHasta > inicio;
    });
    const ocupacion = existentes.reduce((suma, r) => suma + Number(r.asistentes ?? 1), 0);
    if (ocupacion + asistentes > Number(amenity.capacidad ?? 1)) {
      throw errores.conflicto('Ese horario ya no tiene cupo disponible.', {
        capacidad: amenity.capacidad, ocupacion, solicitados: asistentes,
      });
    }

    tx.set(refReserva, {
      amenityId,
      amenityNombre: amenity.nombre,
      unidadId,
      desde: inicio,
      hasta: fin,
      asistentes,
      estado: amenity.requiereAprobacion ? 'pendiente' : 'confirmada',
      autorUid: actorUid,
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    return { id: refReserva.id, estado: amenity.requiereAprobacion ? 'pendiente' : 'confirmada' };
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

