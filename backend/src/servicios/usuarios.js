/** Gestion de usuarios y custom claims de Firebase Auth. */

import { auth, rutas, selloCreacion } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';
import { TODOS_LOS_ROLES, ROLES } from '../middleware/autenticar.js';

export async function crearUsuario({
  email, password, nombre, telefono = null, rol, complejoId = null,
  unidadId = null, complejos = [], obraIds = [],
}, actor) {
  validarGestion(actor, { rol, complejoId, complejos });
  if (!TODOS_LOS_ROLES.includes(rol)) {
    throw errores.datosInvalidos({ rol: 'no es un rol valido' });
  }

  let registro;
  try {
    registro = await auth.createUser({ email, password, displayName: nombre, disabled: false });
    await guardarRol({ uid: registro.uid, rol, complejoId, unidadId, complejos, obraIds });
    await rutas.usuario(registro.uid).set({
      nombre,
      email,
      telefono,
      rol,
      complejoId,
      unidadId,
      complejos,
      obraIds,
      activo: true,
      ...selloCreacion(registro.uid),
    });
  } catch (error) {
    if (registro?.uid) await auth.deleteUser(registro.uid).catch(() => {});
    if (error.code === 'auth/email-already-exists') {
      throw errores.conflicto('Ya existe una cuenta con ese correo.');
    }
    throw error;
  }

  return { uid: registro.uid, email, nombre, rol, complejoId, unidadId };
}

export async function asignarRol(datos, actor) {
  validarGestion(actor, datos);
  const usuario = await auth.getUser(datos.uid).catch((error) => {
    if (error.code === 'auth/user-not-found') throw errores.noEncontrado('El usuario');
    throw error;
  });
  // Se verifica el alcance actual del UID, no solo el complejo solicitado.
  // Las claims de Auth son la autoridad: el perfil no concede permisos.
  validarGestion(actor, usuario.customClaims ?? {});
  const resultado = await guardarRol(datos);
  await auth.revokeRefreshTokens(datos.uid);
  return resultado;
}

function validarGestion(actor, { rol, complejoId = null, complejos = [] }) {
  const operativos = [ROLES.RESIDENTE, ROLES.GUARDIA, ROLES.RESPONSABLE_OBRA];
  if (actor?.rol === ROLES.ADMIN) {
    if (complejoId !== actor.complejoId || !operativos.includes(rol)) {
      throw errores.sinPermiso('Solo podés gestionar residentes, guardias y responsables de obra de tu complejo.');
    }
    return;
  }
  if (actor?.rol === ROLES.SUPERADMIN) {
    const cartera = Array.isArray(actor.complejos) ? actor.complejos : [];
    const destinos = rol === ROLES.SUPERADMIN ? complejos : [complejoId];
    if (!Array.isArray(destinos) || destinos.length === 0 || destinos.some((cid) => !cid || !cartera.includes(cid))) {
      throw errores.sinPermiso('Solo podés gestionar usuarios y carteras incluidos por completo en tu cartera.');
    }
    return;
  }
  throw errores.sinPermiso('Necesitás un rol de administración para gestionar usuarios.');
}

async function guardarRol({ uid, rol, complejoId = null, unidadId = null, complejos = [], obraIds = [] }) {
  if (!TODOS_LOS_ROLES.includes(rol)) {
    throw errores.datosInvalidos({ rol: 'no es un rol valido' });
  }
  if (rol !== ROLES.SUPERADMIN && !complejoId) {
    throw errores.datosInvalidos({ complejoId: 'es obligatorio para este rol' });
  }
  if (rol === ROLES.RESIDENTE && !unidadId) {
    throw errores.datosInvalidos({ unidadId: 'es obligatoria para un residente' });
  }
  if (![complejos, obraIds].every((ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string' && id.length > 0))) {
    throw errores.datosInvalidos({ asignaciones: 'deben ser listas de identificadores válidos' });
  }
  if (rol === ROLES.RESPONSABLE_OBRA && obraIds.length === 0) {
    throw errores.datosInvalidos({ obraIds: 'debe incluir al menos una obra' });
  }

  const claims = {
    rol,
    ...(complejoId ? { complejoId } : {}),
    ...(unidadId ? { unidadId } : {}),
    ...(rol === ROLES.SUPERADMIN ? { complejos: [...new Set(complejos)] } : {}),
    ...(rol === ROLES.RESPONSABLE_OBRA ? { obraIds: [...new Set(obraIds)] } : {}),
  };

  await auth.getUser(uid).catch((error) => {
    if (error.code === 'auth/user-not-found') throw errores.noEncontrado('El usuario');
    throw error;
  });
  await auth.setCustomUserClaims(uid, claims);
  await rutas.usuario(uid).set({
    rol,
    complejoId,
    unidadId,
    complejos: claims.complejos ?? [],
    obraIds: claims.obraIds ?? [],
    activo: true,
    actualizadoEn: new Date(),
  }, { merge: true });

  return { uid, ...claims, requiereRenovarSesion: true };
}
