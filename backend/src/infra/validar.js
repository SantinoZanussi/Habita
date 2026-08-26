/**
 * Validacion de datos de entrada.
 *
 * Es un validador chico escrito a mano en vez de una libreria: son ~150 lineas,
 * no agrega una dependencia mas al arbol y, sobre todo, se puede explicar en la
 * defensa. Cubre exactamente lo que necesitan los formularios de este producto.
 *
 * Devuelve TODOS los errores juntos, no el primero: si un formulario tiene tres
 * campos mal, la persona tiene que enterarse de los tres de una vez.
 */

import { errores } from './errores.js';

const esVacio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Constructores de reglas. Cada uno devuelve una funcion (valor) => error|null. */
export const campo = {
  texto({ minimo = 0, maximo = 5000, patron = null, mensajePatron = 'tiene un formato invalido' } = {}) {
    return (valor) => {
      if (typeof valor !== 'string') return 'tiene que ser texto';
      const limpio = valor.trim();
      if (limpio.length < minimo) return `tiene que tener al menos ${minimo} caracteres`;
      if (limpio.length > maximo) return `no puede superar los ${maximo} caracteres`;
      if (patron && !patron.test(limpio)) return mensajePatron;
      return null;
    };
  },

  numero({ minimo = -Infinity, maximo = Infinity, entero = false } = {}) {
    return (valor) => {
      const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : Number(valor);
      if (!Number.isFinite(n)) return 'tiene que ser un numero';
      if (entero && !Number.isInteger(n)) return 'tiene que ser un numero entero';
      if (n < minimo) return `no puede ser menor a ${minimo}`;
      if (n > maximo) return `no puede ser mayor a ${maximo}`;
      return null;
    };
  },

  /** Monto de dinero en pesos. Acepta "1234,56" y "1234.56". */
  monto({ minimo = 0, maximo = 1_000_000_000 } = {}) {
    return (valor) => {
      const n = typeof valor === 'string' ? Number(valor.replace(/\./g, '').replace(',', '.')) : Number(valor);
      if (!Number.isFinite(n)) return 'tiene que ser un importe valido';
      if (n < minimo) return `no puede ser menor a ${minimo}`;
      if (n > maximo) return 'supera el maximo permitido';
      if (Math.round(n * 100) !== Number((n * 100).toFixed(0))) return 'no puede tener mas de dos decimales';
      return null;
    };
  },

  unoDe(opciones) {
    return (valor) => (opciones.includes(valor) ? null : `tiene que ser uno de: ${opciones.join(', ')}`);
  },

  booleano() {
    return (valor) => (typeof valor === 'boolean' ? null : 'tiene que ser verdadero o falso');
  },

  fechaIso() {
    return (valor) => {
      const fecha = new Date(valor);
      return Number.isNaN(fecha.getTime()) ? 'tiene que ser una fecha valida' : null;
    };
  },

  email() {
    return campo.texto({
      minimo: 5, maximo: 254,
      patron: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
      mensajePatron: 'no parece un correo valido',
    });
  },

  /** Telefono argentino, con o sin +54, con o sin separadores. */
  telefono() {
    return (valor) => {
      const limpio = String(valor ?? '').replace(/[^\d+]/g, '');
      return /^(\+?54)?\d{8,13}$/.test(limpio) ? null : 'no parece un telefono valido';
    };
  },

  /** Patente argentina: vieja (AAA123) o Mercosur (AA123AA). */
  patente() {
    return (valor) => {
      const limpio = String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      return /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/.test(limpio)
        ? null : 'tiene que ser una patente valida (ABC123 o AB123CD)';
    };
  },

  documento() {
    return (valor) => {
      const limpio = String(valor ?? '').replace(/\D/g, '');
      return limpio.length >= 7 && limpio.length <= 9 ? null : 'tiene que ser un documento valido';
    };
  },

  lista({ de = null, minimo = 0, maximo = 500 } = {}) {
    return (valor) => {
      if (!Array.isArray(valor)) return 'tiene que ser una lista';
      if (valor.length < minimo) return `tiene que tener al menos ${minimo} elemento(s)`;
      if (valor.length > maximo) return `no puede tener mas de ${maximo} elementos`;
      if (de) {
        for (const [i, item] of valor.entries()) {
          const error = de(item);
          if (error) return `el elemento ${i + 1} ${error}`;
        }
      }
      return null;
    };
  },

  objeto(esquemaInterno) {
    return (valor) => {
      if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return 'tiene que ser un objeto';
      const { errores: errs } = revisar(valor, esquemaInterno);
      return Object.keys(errs).length > 0
        ? Object.entries(errs).map(([k, v]) => `${k} ${v}`).join('; ')
        : null;
    };
  },
};

/**
 * Revisa un objeto contra un esquema.
 * @param {object} datos
 * @param {Record<string, {regla: Function, requerido?: boolean, porDefecto?: any}>} esquema
 */
export function revisar(datos, esquema) {
  const limpios = {};
  const errs = {};

  for (const [clave, definicion] of Object.entries(esquema)) {
    const { regla, requerido = false, porDefecto = undefined } = definicion;
    const valor = datos?.[clave];

    if (esVacio(valor)) {
      if (requerido) errs[clave] = 'es obligatorio';
      else if (porDefecto !== undefined) limpios[clave] = porDefecto;
      continue;
    }

    const error = regla(valor);
    if (error) errs[clave] = error;
    else limpios[clave] = typeof valor === 'string' ? valor.trim() : valor;
  }

  return { limpios, errores: errs };
}

/**
 * Middleware de Express: valida `req.body` y deja el resultado limpio en
 * `req.datos`. Si algo falla, corta con un 422 que lista todos los campos.
 */
export function validarCuerpo(esquema) {
  return (req, _res, next) => {
    const { limpios, errores: errs } = revisar(req.body ?? {}, esquema);
    if (Object.keys(errs).length > 0) {
      return next(errores.datosInvalidos(errs, 'Revisa los campos marcados'));
    }
    req.datos = limpios;
    next();
  };
}

/** Igual que validarCuerpo pero sobre los parametros de consulta. */
export function validarConsulta(esquema) {
  return (req, _res, next) => {
    const { limpios, errores: errs } = revisar(req.query ?? {}, esquema);
    if (Object.keys(errs).length > 0) {
      return next(errores.datosInvalidos(errs, 'Revisa los parametros de la consulta'));
    }
    req.filtros = limpios;
    next();
  };
}
