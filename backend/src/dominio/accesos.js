/**
 * NUCLEO 2 - Control de acceso: reglas de decision.
 *
 * Este modulo decide SI una autorizacion habilita un ingreso en este momento.
 * La parte transaccional (consumir el uso sin que dos guardias validen el
 * mismo QR a la vez) vive en servicios/accesos.js, porque necesita Firestore.
 * Aca esta la logica pura, que es la que se testea y la que se explica.
 *
 * Dos mecanismos distintos, que se confunden facil:
 *
 *   QR DINAMICO (residente abriendo su propia puerta)
 *     Rota cada 60 segundos. Es un HMAC del uid contra un secreto que solo
 *     conoce el backend. Una captura de pantalla compartida por WhatsApp deja
 *     de servir al minuto. No consume usos: el residente entra las veces que
 *     quiera a su propio complejo.
 *
 *   CODIGO DE AUTORIZACION (visita, proveedor u obrero)
 *     Es fijo, porque se lo mandan a alguien que no tiene la app. Su seguridad
 *     no esta en rotar sino en la VIGENCIA, la FRANJA HORARIA, los DIAS
 *     PERMITIDOS y la CANTIDAD DE USOS. Esa es la que necesita transaccion.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const MOTIVOS_RECHAZO = Object.freeze({
  NO_ENCONTRADA: 'La autorizacion no existe o el codigo es invalido',
  REVOCADA: 'La autorizacion fue revocada por quien la genero',
  AUN_NO_VIGENTE: 'La autorizacion todavia no esta vigente',
  VENCIDA: 'La autorizacion esta vencida',
  DIA_NO_PERMITIDO: 'Hoy no es un dia habilitado para este ingreso',
  FUERA_DE_FRANJA: 'Esta fuera de la franja horaria permitida',
  SIN_USOS: 'La autorizacion ya agoto sus usos',
  PUNTO_NO_HABILITADO: 'Este punto de acceso no esta habilitado para esta autorizacion',
  UNIDAD_INACTIVA: 'La unidad no esta activa en el complejo',
  CODIGO_EXPIRADO: 'El codigo dinamico expiro. Volve a generarlo en la app',
  CODIGO_INVALIDO: 'El codigo dinamico no es valido',
});

const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/**
 * Devuelve la hora local del complejo. Argentina no tiene horario de verano
 * hoy, pero hardcodear -3 es la clase de atajo que rompe el sistema el dia que
 * lo instala un complejo en otra provincia o pais.
 */
export function horaLocal(fecha, zonaHoraria = 'America/Argentina/Buenos_Aires') {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zonaHoraria,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);

  const valor = (tipo) => partes.find((p) => p.type === tipo)?.value ?? '';
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hora = Number(valor('hour')) % 24;
  const minuto = Number(valor('minute'));

  return {
    diaSemana: dias[valor('weekday')],
    nombreDia: NOMBRES_DIA[dias[valor('weekday')]],
    hora,
    minuto,
    minutosDelDia: hora * 60 + minuto,
    fechaIso: `${valor('year')}-${valor('month')}-${valor('day')}`,
  };
}

/** Convierte "08:30" a minutos desde medianoche. */
export function aMinutos(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) throw new TypeError(`Horario invalido: ${hhmm}`);
  return h * 60 + m;
}

/**
 * Evalua una autorizacion contra el momento y el punto de acceso.
 * Devuelve SIEMPRE un motivo entendible: el guardia tiene que poder decirle a
 * la persona por que no puede pasar, y "acceso denegado" no sirve para eso.
 *
 * @param {object} entrada
 * @param {object} entrada.autorizacion  Documento de la coleccion autorizaciones.
 * @param {Date}   [entrada.ahora]
 * @param {string} [entrada.punto]       Id del punto de acceso donde se presenta.
 * @param {string} [entrada.zonaHoraria]
 */
export function evaluarAutorizacion({ autorizacion, ahora = new Date(), punto = null, zonaHoraria }) {
  const rechazo = (motivo, extra = {}) => ({ permitido: false, motivo, ...extra });

  if (!autorizacion) return rechazo(MOTIVOS_RECHAZO.NO_ENCONTRADA);
  if (autorizacion.estado === 'revocada') return rechazo(MOTIVOS_RECHAZO.REVOCADA);

  const desde = aFecha(autorizacion.vigenciaDesde);
  const hasta = aFecha(autorizacion.vigenciaHasta);
  if (desde && ahora < desde) {
    return rechazo(MOTIVOS_RECHAZO.AUN_NO_VIGENTE, { vigenteDesde: desde.toISOString() });
  }
  if (hasta && ahora > hasta) {
    return rechazo(MOTIVOS_RECHAZO.VENCIDA, { vencioEl: hasta.toISOString() });
  }

  const local = horaLocal(ahora, zonaHoraria);

  // Dias permitidos: 0 = domingo. Es la regla que rechaza al obrero que se
  // presenta un domingo, y la que le explica por que.
  const dias = autorizacion.diasPermitidos;
  if (Array.isArray(dias) && dias.length > 0 && !dias.includes(local.diaSemana)) {
    return rechazo(MOTIVOS_RECHAZO.DIA_NO_PERMITIDO, {
      dia: local.nombreDia,
      diasHabilitados: dias.map((d) => NOMBRES_DIA[d]),
    });
  }

  const franja = autorizacion.franjaHoraria;
  if (franja?.desde && franja?.hasta) {
    const inicio = aMinutos(franja.desde);
    const fin = aMinutos(franja.hasta);
    const dentro = inicio <= fin
      ? local.minutosDelDia >= inicio && local.minutosDelDia <= fin
      // Franja que cruza la medianoche (por ejemplo 22:00 a 06:00).
      : local.minutosDelDia >= inicio || local.minutosDelDia <= fin;
    if (!dentro) {
      return rechazo(MOTIVOS_RECHAZO.FUERA_DE_FRANJA, {
        horaActual: `${String(local.hora).padStart(2, '0')}:${String(local.minuto).padStart(2, '0')}`,
        franjaPermitida: `${franja.desde} a ${franja.hasta}`,
      });
    }
  }

  const puntos = autorizacion.puntosHabilitados;
  if (punto && Array.isArray(puntos) && puntos.length > 0 && !puntos.includes(punto)) {
    return rechazo(MOTIVOS_RECHAZO.PUNTO_NO_HABILITADO, { punto, puntosHabilitados: puntos });
  }

  const permitidos = Number(autorizacion.usosPermitidos ?? 0);
  const consumidos = Number(autorizacion.usosConsumidos ?? 0);
  if (permitidos > 0 && consumidos >= permitidos) {
    return rechazo(MOTIVOS_RECHAZO.SIN_USOS, { usosPermitidos: permitidos, usosConsumidos: consumidos });
  }

  return {
    permitido: true,
    motivo: null,
    usosRestantes: permitidos > 0 ? permitidos - consumidos : null,
    venceEl: hasta ? hasta.toISOString() : null,
  };
}

function aFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor?.toDate === 'function') return valor.toDate();   // Timestamp de Firestore
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// ---------------------------------------------------------------------------
//  QR dinamico del residente
// ---------------------------------------------------------------------------

/** Cada cuantos segundos rota el codigo. Coincide con el contador de la app. */
export const VENTANA_SEGUNDOS = 60;

/** Ventanas de tolerancia hacia atras y adelante, por desfasaje de reloj. */
export const TOLERANCIA_VENTANAS = 1;

function firmar(secreto, sujeto, ventana) {
  return createHmac('sha256', secreto).update(`${sujeto}|${ventana}`).digest('base64url').slice(0, 16);
}

/**
 * Genera el codigo dinamico que muestra la app del residente.
 * El contenido del QR no lleva ningun dato personal: solo el uid, la ventana
 * y la firma. Quien lo fotografie no se entera de nada.
 */
export function generarCodigoDinamico({ secreto, sujeto, complejoId, ahora = new Date() }) {
  const ventana = Math.floor(ahora.getTime() / 1000 / VENTANA_SEGUNDOS);
  const firma = firmar(secreto, `${complejoId}:${sujeto}`, ventana);
  const expiraEnSegundos = VENTANA_SEGUNDOS - Math.floor((ahora.getTime() / 1000) % VENTANA_SEGUNDOS);
  return {
    codigo: `HB1.${complejoId}.${sujeto}.${ventana}.${firma}`,
    ventana,
    expiraEnSegundos,
    expiraEn: new Date(ahora.getTime() + expiraEnSegundos * 1000).toISOString(),
  };
}

/**
 * Verifica un codigo dinamico escaneado por el guardia.
 * Compara con `timingSafeEqual` para no filtrar informacion por el tiempo de
 * respuesta. Es exagerado para un TP y cuesta una linea: se hace bien.
 */
export function verificarCodigoDinamico({ secreto, codigo, ahora = new Date() }) {
  const partes = String(codigo ?? '').split('.');
  if (partes.length !== 5 || partes[0] !== 'HB1') {
    return { valido: false, motivo: MOTIVOS_RECHAZO.CODIGO_INVALIDO };
  }

  const [, complejoId, sujeto, ventanaTexto, firmaRecibida] = partes;
  const ventana = Number(ventanaTexto);
  if (!Number.isInteger(ventana)) return { valido: false, motivo: MOTIVOS_RECHAZO.CODIGO_INVALIDO };

  const ventanaActual = Math.floor(ahora.getTime() / 1000 / VENTANA_SEGUNDOS);
  if (Math.abs(ventanaActual - ventana) > TOLERANCIA_VENTANAS) {
    return { valido: false, motivo: MOTIVOS_RECHAZO.CODIGO_EXPIRADO, complejoId, sujeto };
  }

  const esperada = firmar(secreto, `${complejoId}:${sujeto}`, ventana);
  const a = Buffer.from(esperada);
  const b = Buffer.from(firmaRecibida);
  const coincide = a.length === b.length && timingSafeEqual(a, b);

  return coincide
    ? { valido: true, complejoId, sujeto, ventana }
    : { valido: false, motivo: MOTIVOS_RECHAZO.CODIGO_INVALIDO };
}

/** Normaliza una patente argentina: "ab 123 cd" -> "AB123CD". */
export function normalizarPatente(patente) {
  return String(patente ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
