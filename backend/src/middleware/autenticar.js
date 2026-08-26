/**
 * Autenticacion y autorizacion.
 *
 * El cliente manda el ID token de Firebase Auth en `Authorization: Bearer ...`.
 * El backend lo verifica con el Admin SDK y lee el ROL y el COMPLEJO desde las
 * CUSTOM CLAIMS del token, no desde un documento de Firestore.
 *
 * Por que las claims y no un documento: un documento lo puede leer (y a veces
 * escribir) el cliente. Una claim la firma Google con la clave privada del
 * proyecto y el cliente solo puede leerla, nunca fabricarla. Es la misma
 * informacion que evaluan las reglas de Firestore, asi que el backend y las
 * reglas nunca pueden estar en desacuerdo.
 */

import { auth } from '../infra/firebase.js';
import { errores } from '../infra/errores.js';
import { log } from '../infra/log.js';

export const ROLES = Object.freeze({
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin_complejo',
  GUARDIA: 'guardia',
  RESPONSABLE_OBRA: 'responsable_obra',
  RESIDENTE: 'residente',
});

export const TODOS_LOS_ROLES = Object.values(ROLES);

function extraerToken(req) {
  const cabecera = req.get('authorization') ?? '';
  if (cabecera.toLowerCase().startsWith('bearer ')) return cabecera.slice(7).trim();
  return null;
}

/** Exige sesion valida. Deja el usuario en `req.usuario`. */
export async function autenticar(req, _res, next) {
  const token = extraerToken(req);
  if (!token) return next(errores.noAutenticado());

  try {
    const decodificado = await auth.verifyIdToken(token, true);
    req.usuario = {
      uid: decodificado.uid,
      email: decodificado.email ?? null,
      rol: decodificado.rol ?? null,
      complejoId: decodificado.complejoId ?? null,
      unidadId: decodificado.unidadId ?? null,
      complejos: decodificado.complejos ?? [],
      obraIds: decodificado.obraIds ?? [],
    };

    if (!req.usuario.rol) {
      return next(errores.sinPermiso(
        'Tu usuario todavia no tiene un rol asignado. Pedile a la administracion que lo active.'
      ));
    }
    return next();
  } catch (error) {
    if (error.code === 'auth/id-token-expired') {
      return next(errores.noAutenticado('Tu sesion vencio. Volve a iniciar sesion.'));
    }
    if (error.code === 'auth/id-token-revoked') {
      return next(errores.noAutenticado('Tu sesion fue cerrada desde otro dispositivo.'));
    }
    log.aviso('Token rechazado', { codigo: error.code });
    return next(errores.noAutenticado('La sesion no es valida.'));
  }
}

/** Restringe una ruta a ciertos roles. */
export function exigirRol(...roles) {
  return (req, _res, next) => {
    if (!req.usuario) return next(errores.noAutenticado());
    if (!roles.includes(req.usuario.rol)) {
      return next(errores.sinPermiso(
        `Esta operacion es para ${roles.join(' o ')}, y tu rol es ${req.usuario.rol}.`
      ));
    }
    next();
  };
}

/**
 * Verifica que el usuario pertenezca al complejo del parametro `:complejoId`.
 *
 * Es la barrera multi-tenant: sin esto, un admin del complejo A podria leer y
 * escribir el complejo B simplemente cambiando el id en la URL. La regla de
 * Firestore ya lo bloquearia para el cliente, pero el backend usa el Admin SDK
 * y se saltea las reglas, asi que aca hay que chequearlo explicitamente.
 */
export function exigirComplejo(req, _res, next) {
  const { complejoId } = req.params;
  if (!complejoId) return next(errores.datosInvalidos({ complejoId: 'es obligatorio' }));

  const usuario = req.usuario;
  const esSuperadminDeLaCartera =
    usuario.rol === ROLES.SUPERADMIN && usuario.complejos.includes(complejoId);

  if (usuario.complejoId !== complejoId && !esSuperadminDeLaCartera) {
    log.aviso('Intento de acceso cruzado entre complejos', {
      uid: usuario.uid, rol: usuario.rol, suyo: usuario.complejoId, pedido: complejoId,
    });
    return next(errores.sinPermiso('No tenes acceso a este complejo.'));
  }

  req.complejoId = complejoId;
  next();
}

/** Un residente solo opera sobre su propia unidad. */
export function exigirUnidadPropia(campo = 'unidadId') {
  return (req, _res, next) => {
    if (req.usuario.rol !== ROLES.RESIDENTE) return next();
    const pedida = req.params[campo] ?? req.body?.[campo] ?? req.datos?.[campo];
    if (pedida && pedida !== req.usuario.unidadId) {
      return next(errores.sinPermiso('Solo podes operar sobre tu propia unidad.'));
    }
    next();
  };
}

/**
 * Autenticacion opcional: si viene token lo valida, si no, sigue como anonimo.
 * Se usa en el checkout de retorno de Mercado Pago y en la landing.
 */
export async function autenticarOpcional(req, _res, next) {
  const token = extraerToken(req);
  if (!token) return next();
  try {
    const decodificado = await auth.verifyIdToken(token);
    req.usuario = {
      uid: decodificado.uid, rol: decodificado.rol ?? null,
      complejoId: decodificado.complejoId ?? null, unidadId: decodificado.unidadId ?? null,
      complejos: decodificado.complejos ?? [],
    };
  } catch {
    // Token invalido en ruta opcional: se sigue como anonimo, no es un error.
  }
  next();
}
