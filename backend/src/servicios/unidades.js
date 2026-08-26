/** ABM de unidades con validacion contable de coeficientes. */

import { rutas, sello, selloCreacion, aObjeto, aLista } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';
import { validarCoeficientes } from '../dominio/liquidacion.js';
import { normalizarPatente } from '../dominio/accesos.js';

export async function listarUnidades(complejoId, { incluirBajas = false } = {}) {
  const unidades = aLista(await rutas.unidades(complejoId).get());
  return unidades
    .filter((u) => incluirBajas || u.estado !== 'baja')
    .sort((a, b) => String(a.identificador).localeCompare(String(b.identificador), 'es', { numeric: true }));
}

export async function crearUnidad({ complejoId, datos, actorUid }) {
  const repetida = await rutas.unidades(complejoId)
    .where('identificadorNormalizado', '==', datos.identificador.trim().toUpperCase()).limit(1).get();
  if (!repetida.empty) throw errores.conflicto('Ya existe una unidad con ese identificador.');
  const ref = rutas.unidades(complejoId).doc();
  const unidad = normalizar({ ...datos, estado: datos.estado ?? 'ocupada' });
  await ref.set({ ...unidad, saldoAFavor: 0, ...selloCreacion(actorUid) });
  return aObjeto(await ref.get());
}

export async function actualizarUnidad({ complejoId, unidadId, cambios, actorUid }) {
  const ref = rutas.unidad(complejoId, unidadId);
  if (!(await ref.get()).exists) throw errores.noEncontrado('La unidad');
  await ref.update({ ...normalizar(cambios), ...sello(actorUid) });
  return aObjeto(await ref.get());
}

export async function darDeBajaUnidad({ complejoId, unidadId, actorUid }) {
  const ref = rutas.unidad(complejoId, unidadId);
  if (!(await ref.get()).exists) throw errores.noEncontrado('La unidad');
  await ref.update({ estado: 'baja', bajaEn: new Date(), ...sello(actorUid) });
  return { id: unidadId, estado: 'baja' };
}

export async function validarCoeficientesDelComplejo(complejoId) {
  const unidades = (await listarUnidades(complejoId)).map(({ id, coeficiente }) => ({ id, coeficiente }));
  return validarCoeficientes(unidades);
}

function normalizar(datos) {
  const salida = { ...datos };
  if (datos.identificador !== undefined) {
    salida.identificador = datos.identificador.trim();
    salida.identificadorNormalizado = salida.identificador.toUpperCase();
  }
  if (datos.coeficiente !== undefined) salida.coeficiente = Number(datos.coeficiente);
  if (datos.superficie !== undefined) salida.superficie = Number(datos.superficie);
  if (datos.patentesAutorizadas !== undefined) {
    salida.patentesAutorizadas = [...new Set(datos.patentesAutorizadas.map(normalizarPatente).filter(Boolean))];
  }
  return salida;
}

