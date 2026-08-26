/**
 * Middlewares de error.
 *
 * Todo lo que se rompe en el backend termina aca y sale con la misma forma.
 * El cliente nunca ve un stack trace, un mensaje de Firestore ni el nombre de
 * una coleccion: eso queda en el log del servidor.
 */

import { ErrorHabita, errores } from '../infra/errores.js';
import { log } from '../infra/log.js';
import { entorno } from '../config/entorno.js';

/** Ruta inexistente. */
export function noEncontrado(req, _res, next) {
  next(new ErrorHabita('RUTA_NO_ENCONTRADA', `No existe la ruta ${req.method} ${req.path}`, { estado: 404 }));
}

/** Traduce errores de Firestore y de Auth a errores del dominio. */
function traducir(error) {
  if (error instanceof ErrorHabita) return error;

  const codigo = error?.code ?? '';

  if (codigo === 'permission-denied' || codigo === 7) {
    return errores.sinPermiso('La base rechazo la operacion por reglas de seguridad.');
  }
  if (codigo === 'not-found' || codigo === 5) {
    return errores.noEncontrado('El documento');
  }
  if (codigo === 'already-exists' || codigo === 6) {
    return errores.conflicto('Ese registro ya existe.');
  }
  if (codigo === 'aborted' || codigo === 10) {
    return errores.conflicto(
      'Otra persona modifico este dato al mismo tiempo. Volve a intentar.',
      { motivo: 'transaccion_abortada' }
    );
  }
  if (codigo === 'deadline-exceeded' || codigo === 4 || codigo === 'unavailable' || codigo === 14) {
    return errores.servicioExterno('la base de datos', error);
  }
  if (String(codigo).startsWith('auth/')) {
    return errores.noAutenticado('No pudimos validar la sesion.');
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return errores.datosInvalidos({ cuerpo: 'no es JSON valido' });
  }
  if (error instanceof RangeError || error instanceof TypeError) {
    // Los motores de dominio tiran RangeError cuando los datos no cierran.
    return errores.reglaDeNegocio('REGLA_DE_NEGOCIO', error.message);
  }

  return errores.interno(error);
}

/** Middleware final de errores. Tiene que declarar los cuatro parametros. */
export function manejarErrores(error, req, res, _next) {
  const traducido = traducir(error);

  const contexto = {
    ruta: `${req.method} ${req.path}`,
    codigo: traducido.codigo,
    estado: traducido.estado,
    uid: req.usuario?.uid ?? null,
    complejoId: req.complejoId ?? null,
  };

  if (traducido.estado >= 500) {
    log.error(traducido.message, { ...contexto, stack: error?.stack, causa: error?.cause?.message });
  } else {
    log.aviso(traducido.message, contexto);
  }

  const cuerpo = traducido.aRespuesta();
  // En desarrollo se agrega el detalle tecnico para poder depurar rapido.
  if (entorno.modo !== 'production' && traducido.estado >= 500) {
    cuerpo.error.tecnico = error?.message;
  }

  res.status(traducido.estado).json(cuerpo);
}

/**
 * Limitador de peticiones en memoria.
 *
 * Es suficiente para un backend de una sola instancia y no agrega dependencias.
 * Si el dia de manana corre en varias instancias, esto se cambia por Redis y no
 * se toca nada mas: la interfaz es la misma.
 */
export function limitar({ porMinuto = 60, clave = (req) => req.ip } = {}) {
  const ventanas = new Map();

  // Limpieza periodica para que el Map no crezca sin techo.
  const limpieza = setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of ventanas) if (ahora - v.inicio > 120_000) ventanas.delete(k);
  }, 60_000);
  limpieza.unref?.();

  return (req, res, next) => {
    const k = clave(req);
    const ahora = Date.now();
    const registro = ventanas.get(k);

    if (!registro || ahora - registro.inicio > 60_000) {
      ventanas.set(k, { inicio: ahora, cuenta: 1 });
      return next();
    }

    registro.cuenta += 1;
    if (registro.cuenta > porMinuto) {
      const restan = Math.ceil((60_000 - (ahora - registro.inicio)) / 1000);
      res.set('Retry-After', String(restan));
      return next(errores.demasiadasPeticiones(restan));
    }
    next();
  };
}
