/**
 * Errores del dominio.
 *
 * Regla de resiliencia de la materia: la aplicacion no puede mostrar pantallas
 * rojas. Para que el cliente pueda mostrar un mensaje util en vez de "algo
 * salio mal", el backend tiene que devolver SIEMPRE la misma forma:
 *
 *   { error: { codigo, mensaje, detalles?, sugerencia? } }
 *
 * `codigo` lo consume la app (para decidir que hacer), `mensaje` lo lee la
 * persona. Nunca se filtra un stack trace ni un mensaje de Firestore al cliente.
 */

export class ErrorHabita extends Error {
  /**
   * @param {string} codigo    Codigo estable que consume el cliente.
   * @param {string} mensaje   Texto en castellano para mostrarle a la persona.
   * @param {object} opciones
   */
  constructor(codigo, mensaje, { estado = 400, detalles = null, sugerencia = null, causa = null } = {}) {
    super(mensaje, { cause: causa });
    this.name = 'ErrorHabita';
    this.codigo = codigo;
    this.estado = estado;
    this.detalles = detalles;
    this.sugerencia = sugerencia;
  }

  aRespuesta() {
    return {
      error: {
        codigo: this.codigo,
        mensaje: this.message,
        ...(this.detalles ? { detalles: this.detalles } : {}),
        ...(this.sugerencia ? { sugerencia: this.sugerencia } : {}),
      },
    };
  }
}

/** Atajos para los casos que se repiten en todas las rutas. */
export const errores = {
  datosInvalidos: (detalles, mensaje = 'Los datos enviados no son validos') =>
    new ErrorHabita('DATOS_INVALIDOS', mensaje, { estado: 422, detalles }),

  noAutenticado: (mensaje = 'Necesitas iniciar sesion para hacer esto') =>
    new ErrorHabita('NO_AUTENTICADO', mensaje, { estado: 401 }),

  sinPermiso: (mensaje = 'Tu rol no tiene permiso para esta operacion') =>
    new ErrorHabita('SIN_PERMISO', mensaje, { estado: 403 }),

  noEncontrado: (que = 'El recurso') =>
    new ErrorHabita('NO_ENCONTRADO', `${que} no existe o fue dado de baja`, { estado: 404 }),

  conflicto: (mensaje, detalles = null) =>
    new ErrorHabita('CONFLICTO', mensaje, { estado: 409, detalles }),

  reglaDeNegocio: (codigo, mensaje, detalles = null, sugerencia = null) =>
    new ErrorHabita(codigo, mensaje, { estado: 422, detalles, sugerencia }),

  servicioExterno: (servicio, causa) =>
    new ErrorHabita(
      'SERVICIO_EXTERNO_CAIDO',
      `No pudimos comunicarnos con ${servicio}. Volve a intentar en unos minutos.`,
      { estado: 503, detalles: { servicio }, causa, sugerencia: 'La operacion no se realizo: no se duplico nada.' }
    ),

  demasiadasPeticiones: (segundos) =>
    new ErrorHabita('DEMASIADAS_PETICIONES', 'Estas haciendo demasiadas operaciones seguidas.', {
      estado: 429,
      sugerencia: `Espera ${segundos} segundos y volve a intentar.`,
    }),

  interno: (causa) =>
    new ErrorHabita('ERROR_INTERNO', 'Ocurrio un error inesperado. Ya quedo registrado.', {
      estado: 500, causa,
    }),
};

/** Envuelve un handler async para que sus rechazos lleguen al middleware de errores. */
export const asincrono = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
