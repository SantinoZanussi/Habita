/** Configuracion multi-tenant de complejos. */

import { rutas, sello, selloCreacion, aObjeto, aLista } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';

export const TIPOS_COMPLEJO = Object.freeze(['edificio', 'consorcio', 'barrio', 'country']);
export const TIPOS_UNIDAD = Object.freeze(['departamento', 'casa', 'lote']);
export const NOMENCLATURAS = Object.freeze(['expensa', 'cuota', 'aporte']);
export const METODOS_ACCESO = Object.freeze(['qr', 'nfc', 'patente']);

const defaults = {
  tipo: 'edificio',
  tipoUnidad: 'departamento',
  nomenclaturaAporte: 'expensa',
  metodosAcceso: ['qr'],
  modulosActivos: { obras: true, evaluacion: false, consumos: false },
  politicaRedondeo: 'mayorResto',
  porcentajeFondoReserva: 10,
  tasaMoraMensual: 3,
  modoMora: 'simple',
  diasGraciaMora: 0,
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  puntosAcceso: [{ id: 'torre-principal', nombre: 'Torre - Entrada principal' }],
  activo: true,
};

export async function crearComplejo({ datos, actorUid }) {
  const ref = datos.id ? rutas.complejo(datos.id) : rutas.complejos().doc();
  if ((await ref.get()).exists) throw errores.conflicto('Ya existe un complejo con ese identificador.');
  const complejo = { ...defaults, ...datos, ...selloCreacion(actorUid) };
  delete complejo.id;
  await ref.set(complejo);
  return { id: ref.id, ...complejo };
}

export async function actualizarComplejo({ complejoId, cambios, actorUid }) {
  const ref = rutas.complejo(complejoId);
  if (!(await ref.get()).exists) throw errores.noEncontrado('El complejo');
  await ref.update({ ...cambios, ...sello(actorUid) });
  return aObjeto(await ref.get());
}

export async function obtenerComplejo(complejoId) {
  const complejo = aObjeto(await rutas.complejo(complejoId).get());
  if (!complejo) throw errores.noEncontrado('El complejo');
  return complejo;
}

export async function listarComplejos(ids = null) {
  const todos = aLista(await rutas.complejos().where('activo', '==', true).get());
  return ids ? todos.filter((c) => ids.includes(c.id)) : todos;
}

