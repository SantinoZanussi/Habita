import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluarAutorizacion, generarCodigoDinamico, verificarCodigoDinamico,
  horaLocal, aMinutos, normalizarPatente, MOTIVOS_RECHAZO, VENTANA_SEGUNDOS,
} from '../src/dominio/accesos.js';

const SECRETO = 'secreto-de-prueba-no-usar-en-produccion';

/** 2026-08-21 es viernes. Las horas son UTC; Argentina es UTC-3. */
const viernes14 = new Date('2026-08-21T17:00:00Z');   // viernes 14:00 en Argentina
const viernes20 = new Date('2026-08-21T23:00:00Z');   // viernes 20:00
const domingo10 = new Date('2026-08-23T13:00:00Z');   // domingo 10:00

const visitaBase = {
  tipo: 'visita',
  estado: 'vigente',
  vigenciaDesde: new Date('2026-08-21T00:00:00Z'),
  vigenciaHasta: new Date('2026-08-22T01:00:00Z'),   // viernes 22:00 hora local
  usosPermitidos: 2,
  usosConsumidos: 0,
};

test('horaLocal traduce a la zona horaria del complejo', () => {
  const local = horaLocal(viernes14);
  assert.equal(local.hora, 14);
  assert.equal(local.nombreDia, 'viernes');
  assert.equal(local.diaSemana, 5);
});

test('aMinutos convierte horarios de reglamento', () => {
  assert.equal(aMinutos('08:00'), 480);
  assert.equal(aMinutos('18:30'), 1110);
  assert.throws(() => aMinutos('nueve'), /Horario invalido/);
});

test('una autorizacion vigente y con usos disponibles permite el ingreso', () => {
  const r = evaluarAutorizacion({ autorizacion: visitaBase, ahora: viernes14 });
  assert.equal(r.permitido, true);
  assert.equal(r.usosRestantes, 2);
});

test('una autorizacion revocada se rechaza con el motivo', () => {
  const r = evaluarAutorizacion({ autorizacion: { ...visitaBase, estado: 'revocada' }, ahora: viernes14 });
  assert.equal(r.permitido, false);
  assert.equal(r.motivo, MOTIVOS_RECHAZO.REVOCADA);
});

test('una autorizacion vencida se rechaza e informa cuando vencio', () => {
  const r = evaluarAutorizacion({ autorizacion: visitaBase, ahora: new Date('2026-08-23T00:00:00Z') });
  assert.equal(r.permitido, false);
  assert.equal(r.motivo, MOTIVOS_RECHAZO.VENCIDA);
  assert.ok(r.vencioEl);
});

test('EL MOMENTO DE LA DEMO: el segundo escaneo del mismo QR se rechaza', () => {
  const agotada = { ...visitaBase, usosPermitidos: 1, usosConsumidos: 1 };
  const r = evaluarAutorizacion({ autorizacion: agotada, ahora: viernes14 });
  assert.equal(r.permitido, false);
  assert.equal(r.motivo, MOTIVOS_RECHAZO.SIN_USOS);
  assert.equal(r.usosConsumidos, 1);
});

test('un obrero que se presenta un domingo es rechazado indicando el motivo', () => {
  const permisoDeObra = {
    tipo: 'obra',
    estado: 'vigente',
    vigenciaDesde: new Date('2026-08-01T00:00:00Z'),
    vigenciaHasta: new Date('2026-12-31T00:00:00Z'),
    diasPermitidos: [1, 2, 3, 4, 5, 6],       // lunes a sabado
    franjaHoraria: { desde: '08:00', hasta: '18:00' },
    usosPermitidos: 0,                         // sin tope de usos
    usosConsumidos: 0,
  };

  const enDomingo = evaluarAutorizacion({ autorizacion: permisoDeObra, ahora: domingo10 });
  assert.equal(enDomingo.permitido, false);
  assert.equal(enDomingo.motivo, MOTIVOS_RECHAZO.DIA_NO_PERMITIDO);
  assert.equal(enDomingo.dia, 'domingo');

  const enViernes = evaluarAutorizacion({ autorizacion: permisoDeObra, ahora: viernes14 });
  assert.equal(enViernes.permitido, true);
});

test('fuera de la franja horaria se rechaza e informa la franja permitida', () => {
  const permisoDeObra = {
    estado: 'vigente',
    vigenciaDesde: new Date('2026-08-01T00:00:00Z'),
    vigenciaHasta: new Date('2026-12-31T00:00:00Z'),
    franjaHoraria: { desde: '08:00', hasta: '18:00' },
    usosPermitidos: 0, usosConsumidos: 0,
  };
  const r = evaluarAutorizacion({ autorizacion: permisoDeObra, ahora: viernes20 });
  assert.equal(r.permitido, false);
  assert.equal(r.motivo, MOTIVOS_RECHAZO.FUERA_DE_FRANJA);
  assert.equal(r.horaActual, '20:00');
  assert.equal(r.franjaPermitida, '08:00 a 18:00');
});

test('una franja que cruza la medianoche funciona', () => {
  const nocturna = {
    estado: 'vigente',
    vigenciaDesde: new Date('2026-08-01T00:00:00Z'),
    vigenciaHasta: new Date('2026-12-31T00:00:00Z'),
    franjaHoraria: { desde: '22:00', hasta: '06:00' },
    usosPermitidos: 0, usosConsumidos: 0,
  };
  assert.equal(evaluarAutorizacion({ autorizacion: nocturna, ahora: viernes20 }).permitido, false);
  assert.equal(evaluarAutorizacion({ autorizacion: nocturna, ahora: new Date('2026-08-22T02:00:00Z') }).permitido, true);
});

test('un punto de acceso no habilitado se rechaza', () => {
  const soloPeatonal = { ...visitaBase, puntosHabilitados: ['molinete-peatonal'] };
  const r = evaluarAutorizacion({ autorizacion: soloPeatonal, ahora: viernes14, punto: 'barrera-vehicular' });
  assert.equal(r.permitido, false);
  assert.equal(r.motivo, MOTIVOS_RECHAZO.PUNTO_NO_HABILITADO);
});

test('una autorizacion inexistente no rompe: devuelve un motivo entendible', () => {
  const r = evaluarAutorizacion({ autorizacion: null, ahora: viernes14 });
  assert.equal(r.permitido, false);
  assert.equal(r.motivo, MOTIVOS_RECHAZO.NO_ENCONTRADA);
});

// ------------------------------------------------------------- QR dinamico

test('el QR dinamico se genera y se verifica', () => {
  const ahora = new Date('2026-08-21T17:00:30Z');
  const { codigo, expiraEnSegundos } = generarCodigoDinamico({
    secreto: SECRETO, sujeto: 'uid-residente', complejoId: 'torre-del-parque', ahora,
  });
  assert.ok(codigo.startsWith('HB1.'));
  assert.equal(expiraEnSegundos, 30);

  const r = verificarCodigoDinamico({ secreto: SECRETO, codigo, ahora });
  assert.equal(r.valido, true);
  assert.equal(r.sujeto, 'uid-residente');
  assert.equal(r.complejoId, 'torre-del-parque');
});

test('el QR dinamico no lleva ningun dato personal', () => {
  const { codigo } = generarCodigoDinamico({
    secreto: SECRETO, sujeto: 'uid-abc', complejoId: 'cx1', ahora: new Date(),
  });
  assert.equal(codigo.includes('@'), false);
  assert.equal(/nombre|dni|telefono/i.test(codigo), false);
});

test('una captura de pantalla vieja deja de servir', () => {
  const ahora = new Date('2026-08-21T17:00:00Z');
  const { codigo } = generarCodigoDinamico({ secreto: SECRETO, sujeto: 'uid', complejoId: 'cx1', ahora });

  const masTarde = new Date(ahora.getTime() + VENTANA_SEGUNDOS * 3 * 1000);
  const r = verificarCodigoDinamico({ secreto: SECRETO, codigo, ahora: masTarde });
  assert.equal(r.valido, false);
  assert.equal(r.motivo, MOTIVOS_RECHAZO.CODIGO_EXPIRADO);
});

test('tolera un desfasaje de reloj de una ventana', () => {
  const ahora = new Date('2026-08-21T17:00:00Z');
  const { codigo } = generarCodigoDinamico({ secreto: SECRETO, sujeto: 'uid', complejoId: 'cx1', ahora });
  const casiTarde = new Date(ahora.getTime() + VENTANA_SEGUNDOS * 1000);
  assert.equal(verificarCodigoDinamico({ secreto: SECRETO, codigo, ahora: casiTarde }).valido, true);
});

test('un codigo firmado con otro secreto no valida', () => {
  const ahora = new Date();
  const { codigo } = generarCodigoDinamico({ secreto: 'otro-secreto', sujeto: 'uid', complejoId: 'cx1', ahora });
  const r = verificarCodigoDinamico({ secreto: SECRETO, codigo, ahora });
  assert.equal(r.valido, false);
  assert.equal(r.motivo, MOTIVOS_RECHAZO.CODIGO_INVALIDO);
});

test('un codigo manipulado no valida', () => {
  const ahora = new Date();
  const { codigo } = generarCodigoDinamico({ secreto: SECRETO, sujeto: 'uid-victima', complejoId: 'cx1', ahora });
  const manipulado = codigo.replace('uid-victima', 'uid-atacante');
  assert.equal(verificarCodigoDinamico({ secreto: SECRETO, codigo: manipulado, ahora }).valido, false);
});

test('basura en el escaner no rompe el backend', () => {
  for (const basura of ['', null, undefined, 'hola', 'HB1.solo.tres.partes', '{"json":true}']) {
    const r = verificarCodigoDinamico({ secreto: SECRETO, codigo: basura });
    assert.equal(r.valido, false);
  }
});

test('normalizarPatente limpia lo que escribe el guardia a mano', () => {
  assert.equal(normalizarPatente('ab 123 cd'), 'AB123CD');
  assert.equal(normalizarPatente('AE-456-XY'), 'AE456XY');
  assert.equal(normalizarPatente(null), '');
});
