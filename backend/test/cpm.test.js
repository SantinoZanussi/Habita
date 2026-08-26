import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularCaminoCritico, ordenTopologico, reestimarDuracion, sumarDias, compararAvanceContraGasto,
} from '../src/dominio/cpm.js';

const INICIO = new Date('2026-09-01T00:00:00Z');   // martes

/**
 * Obra de ejemplo. Dos ramas en paralelo despues del movimiento de suelo:
 *
 *   suelo(5) -> fundacion(10) -> estructura(20) -> mamposteria(15) -> terminacion(10)
 *   suelo(5) -> cerco(3) ------------------------------------------> terminacion(10)
 *
 * El camino critico es la rama larga. "cerco" tiene mucha holgura.
 */
const OBRA = [
  { id: 'suelo', nombre: 'Movimiento de suelo', duracionEstimada: 5, predecesoras: [] },
  { id: 'fundacion', nombre: 'Fundacion', duracionEstimada: 10, predecesoras: ['suelo'] },
  { id: 'estructura', nombre: 'Estructura', duracionEstimada: 20, predecesoras: ['fundacion'] },
  { id: 'mamposteria', nombre: 'Mamposteria', duracionEstimada: 15, predecesoras: ['estructura'] },
  { id: 'cerco', nombre: 'Cerco perimetral', duracionEstimada: 3, predecesoras: ['suelo'] },
  { id: 'terminacion', nombre: 'Terminaciones', duracionEstimada: 10, predecesoras: ['mamposteria', 'cerco'] },
];

test('ordenTopologico respeta las dependencias', () => {
  const { orden } = ordenTopologico(OBRA);
  assert.ok(orden.indexOf('suelo') < orden.indexOf('fundacion'));
  assert.ok(orden.indexOf('mamposteria') < orden.indexOf('terminacion'));
  assert.equal(orden.length, OBRA.length);
});

test('una dependencia circular se rechaza en vez de colgar el calculo', () => {
  assert.throws(
    () => ordenTopologico([
      { id: 'a', duracionEstimada: 1, predecesoras: ['b'] },
      { id: 'b', duracionEstimada: 1, predecesoras: ['a'] },
    ]),
    /dependencia circular/
  );
});

test('una predecesora inexistente se rechaza con el id que falta', () => {
  assert.throws(
    () => ordenTopologico([{ id: 'a', duracionEstimada: 1, predecesoras: ['fantasma'] }]),
    /"fantasma", que no existe/
  );
});

test('identifica el camino critico y la holgura de las partidas que no lo son', () => {
  const r = calcularCaminoCritico({ partidas: OBRA, fechaInicio: INICIO });

  assert.equal(r.duracionPlanificada, 60, '5 + 10 + 20 + 15 + 10');
  assert.deepEqual(r.caminoCritico, ['suelo', 'fundacion', 'estructura', 'mamposteria', 'terminacion']);

  const cerco = r.partidas.find((p) => p.id === 'cerco');
  assert.equal(cerco.esCritica, false);
  assert.equal(cerco.holgura, 42, 'el cerco puede atrasarse 42 dias sin mover la obra');
});

test('EL MOMENTO DE LA DEMO: atrasar una partida critica corre la obra entera', () => {
  const antes = calcularCaminoCritico({ partidas: OBRA, fechaInicio: INICIO });

  // El responsable carga que la estructura lleva 12 dias y va por el 40 %:
  // a ese ritmo termina en 30 dias, no en 20.
  const conAtraso = OBRA.map((p) =>
    p.id === 'estructura' ? { ...p, avancePorcentaje: 40, diasTranscurridos: 12 } : p
  );
  const despues = calcularCaminoCritico({ partidas: conAtraso, fechaInicio: INICIO });

  assert.equal(despues.partidas.find((p) => p.id === 'estructura').duracionProyectada, 30);
  assert.equal(despues.corrimientoDias, 10, 'la obra se corre los mismos 10 dias');
  assert.equal(despues.hayCorrimiento, true);
  assert.ok(despues.fechaFinEstimada > antes.fechaFinPlanificada);
});

test('atrasar una partida CON holgura no mueve la fecha de fin', () => {
  const conAtraso = OBRA.map((p) =>
    p.id === 'cerco' ? { ...p, avancePorcentaje: 25, diasTranscurridos: 2 } : p
  );
  const r = calcularCaminoCritico({ partidas: conAtraso, fechaInicio: INICIO });
  assert.equal(r.partidas.find((p) => p.id === 'cerco').duracionProyectada, 8);
  assert.equal(r.corrimientoDias, 0, 'el cerco tenia 42 dias de holgura: 8 no la agotan');
});

test('si el atraso agota la holgura, la partida se vuelve critica', () => {
  const conAtraso = OBRA.map((p) =>
    p.id === 'cerco' ? { ...p, avancePorcentaje: 5, diasTranscurridos: 5 } : p
  );
  const r = calcularCaminoCritico({ partidas: conAtraso, fechaInicio: INICIO });
  const cerco = r.partidas.find((p) => p.id === 'cerco');
  assert.equal(cerco.duracionProyectada, 100);
  assert.equal(cerco.esCritica, true);
  assert.equal(r.corrimientoDias, 55, 'ahora el cerco manda: 5 + 100 + 10 = 115 contra 60 planificados');
});

test('reestimarDuracion proyecta a partir del rendimiento real', () => {
  assert.equal(reestimarDuracion({ duracionEstimada: 10, avancePorcentaje: 50, diasTranscurridos: 5 }).duracion, 10);
  assert.equal(reestimarDuracion({ duracionEstimada: 10, avancePorcentaje: 25, diasTranscurridos: 5 }).duracion, 20);
  assert.equal(reestimarDuracion({ duracionEstimada: 10, avancePorcentaje: 0, diasTranscurridos: 0 }).duracion, 10);
  // Una partida adelantada no acorta la obra por si sola.
  assert.equal(reestimarDuracion({ duracionEstimada: 10, avancePorcentaje: 90, diasTranscurridos: 5 }).duracion, 10);
});

test('el calendario de obra no cuenta los domingos', () => {
  // 2026-09-01 es martes. Diez dias habiles (lunes a sabado) caen el 12/09.
  const habil = sumarDias(INICIO, 10, { calendario: 'habil' });
  const corrido = sumarDias(INICIO, 10, { calendario: 'corrido' });
  assert.equal(habil.toISOString().slice(0, 10), '2026-09-12');
  assert.equal(corrido.toISOString().slice(0, 10), '2026-09-11');
  assert.equal(habil.getUTCDay() === 0, false, 'nunca cae en domingo');
});

test('el avance fisico pondera por presupuesto cuando esta cargado', () => {
  const partidas = [
    { id: 'a', nombre: 'A', duracionEstimada: 10, avancePorcentaje: 100, presupuestoCentavos: 9_000_000 },
    { id: 'b', nombre: 'B', duracionEstimada: 10, avancePorcentaje: 0, presupuestoCentavos: 1_000_000 },
  ];
  const r = calcularCaminoCritico({ partidas, fechaInicio: INICIO });
  assert.equal(r.avanceFisicoPorcentaje, 90, 'la partida cara pesa mas que la barata');
});

test('compararAvanceContraGasto detecta la obra que se come el presupuesto', () => {
  const r = compararAvanceContraGasto({
    avanceFisicoPorcentaje: 40,
    presupuestoAprobadoCentavos: 100_000_000,
    gastoEjecutadoCentavos: 75_000_000,
  });
  assert.equal(r.avanceGastoPorcentaje, 75);
  assert.equal(r.desvioPorcentaje, 35);
  assert.equal(r.enAlerta, true);
  assert.equal(r.costoProyectadoCentavos, 187_500_000, 'a este ritmo la obra sale casi el doble');
});

test('una obra sin partidas no rompe el calculo', () => {
  const r = calcularCaminoCritico({ partidas: [], fechaInicio: INICIO });
  assert.equal(r.duracionPlanificada, 0);
  assert.deepEqual(r.caminoCritico, []);
});

test('rechaza partidas con id repetido', () => {
  assert.throws(
    () => calcularCaminoCritico({
      partidas: [
        { id: 'a', nombre: 'A', duracionEstimada: 1 },
        { id: 'a', nombre: 'A bis', duracionEstimada: 1 },
      ],
      fechaInicio: INICIO,
    }),
    /mismo identificador/
  );
});
