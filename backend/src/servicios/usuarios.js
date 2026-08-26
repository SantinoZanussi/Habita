/** Gestion de usuarios y custom claims de Firebase Auth. */

import { auth, rutas, selloCreacion } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';
import { TODOS_LOS_ROLES, ROLES } from '../middleware/autenticar.js';

export async function crearUsuario({
  email, password, nombre, telefono = null, rol, complejoId = null,
  unidadId = null, complejos = [], obraIds = [],
}) {
  if (!TODOS_LOS_ROLES.includes(rol)) {
    throw errores.datosInvalidos({ rol: 'no es un rol valido' });
  }

  let registro;
  try {
    registro = await auth.createUser({ email, password, displayName: nombre, disabled: false });
    await asignarRol({ uid: registro.uid, rol, complejoId, unidadId, complejos, obraIds });
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

export async function asignarRol({ uid, rol, complejoId = null, unidadId = null, complejos = [], obraIds = [] }) {
  if (!TODOS_LOS_ROLES.includes(rol)) {
    throw errores.datosInvalidos({ rol: 'no es un rol valido' });
  }
  if (rol !== ROLES.SUPERADMIN && !complejoId) {
    throw errores.datosInvalidos({ complejoId: 'es obligatorio para este rol' });
  }
  if (rol === ROLES.RESIDENTE && !unidadId) {
    throw errores.datosInvalidos({ unidadId: 'es obligatoria para un residente' });
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

