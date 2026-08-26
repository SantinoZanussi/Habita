import test from 'node:test';
import assert from 'node:assert/strict';

import { repartirExacto, aCentavos, verificarCierre, COEFICIENTE_TOTAL } from '../src/dominio/dinero.js';
import {
  liquidarPeriodo, validarCoeficientes, armarCuentaCorriente, CRITERIOS, A_CARGO_DE, POLITICAS_REDONDEO,
} from '../src/dominio/liquidacion.js';

/** Arma N unidades con coeficientes que suman 100 % exacto, repartiendo el resto. */
function unidadesDePrueba(cantidad) {
  const base = Math.floor(COEFICIENTE_TOTAL / cantidad);
  const sobrante = COEFICIENTE_TOTAL - base * cantidad;
  return Array.from({ length: cantidad }, (_, i) => ({
    id: `u${String(i + 1).padStart(3, '0')}`,
    coeficiente: (base + (i < sobrante ? 1 : 0)) / 10_000,
  }));
}

test('aCentavos no arrastra el error binario de los decimales', () => {
  assert.equal(aCentavos(0.1) + aCentavos(0.2), 30);
  assert.equal(aCentavos(1234.56), 123456);
  assert.equal(aCentavos(19.99), 1999);
  assert.equal(aCentavos(0.07), 7);
  assert.equal(aCentavos(4934250.55), 493425055);
});

test('repartirExacto cierra al centavo con un total que no divide', () => {
  // 100 pesos entre 3 partes iguales: 33,34 + 33,33 + 33,33 = 100,00
  const reparto = repartirExacto(10_000, [
    { id: 'a', peso: 1 }, { id: 'b', peso: 1 }, { id: 'c', peso: 1 },
  ]);
  assert.equal(reparto.reduce((acc, r) => acc + r.monto, 0), 10_000);
  assert.deepEqual(reparto.map((r) => r.monto).sort((x, y) => y - x), [3334, 3333, 3333]);
});

test('repartirExacto es determinista: dos corridas dan lo mismo', () => {
  const partes = unidadesDePrueba(7).map((u, i) => ({ id: u.id, peso: 100_000 + i }));
  const a = repartirExacto(999_991, partes);
  const b = repartirExacto(999_991, partes);
  assert.deepEqual(a, b);
});

test('repartirExacto maneja montos negativos (notas de credito)', () => {
  const reparto = repartirExacto(-10_000, [
    { id: 'a', peso: 1 }, { id: 'b', peso: 1 }, { id: 'c', peso: 1 },
  ]);
  assert.equal(reparto.reduce((acc, r) => acc + r.monto, 0), -10_000);
});

test('validarCoeficientes detecta un reglamento mal cargado', () => {
  assert.equal(validarCoeficientes(unidadesDePrueba(40)).valido, true);
  const roto = [{ id: 'a', coeficiente: 50 }, { id: 'b', coeficiente: 49.9 }];
  const resultado = validarCoeficientes(roto);
  assert.equal(resultado.valido, false);
  assert.equal(resultado.sumaPorcentaje, 99.9);
});

test('liquidarPeriodo rechaza liquidar si los coeficientes no suman 100', () => {
  assert.throws(
    () => liquidarPeriodo({
      unidades: [{ id: 'a', coeficiente: 60 }, { id: 'b', coeficiente: 30 }],
      gastosOrdinarios: [{ id: 'g1', concepto: 'Limpieza', montoCentavos: 100_000 }],
    }),
    /tienen que sumar 100/
  );
});

test('LA RESTRICCION DURA: la suma de las liquidaciones da exactamente el gasto total', () => {
  // 152 unidades, montos feos a proposito: es el caso donde el redondeo rompe.
  const unidades = unidadesDePrueba(152);
  const resultado = liquidarPeriodo({
    unidades,
    gastosOrdinarios: [
      { id: 'g1', concepto: 'Sueldo encargado', montoCentavos: aCentavos(1_847_333.33) },
      { id: 'g2', concepto: 'Luz de pasillos', montoCentavos: aCentavos(213_777.77) },
      { id: 'g3', concepto: 'Ascensor', montoCentavos: aCentavos(619_111.11) },
      { id: 'g4', concepto: 'Portero electrico', montoCentavos: aCentavos(99_999.99), criterio: CRITERIOS.PARTES_IGUALES },
    ],
    gastosExtraordinarios: [
      { id: 'e1', concepto: 'Cambio de ascensor', montoCentavos: aCentavos(1_120_000.01), aCargoDe: A_CARGO_DE.PROPIETARIO },
    ],
    fondoReserva: { modo: 'porcentaje', valor: 8 },
  });

  assert.equal(resultado.verificacion.cierra, true, 'la liquidacion tiene que cerrar exacta');
  assert.equal(resultado.verificacion.ordinario.diferencia, 0);
  assert.equal(resultado.verificacion.extraordinario.diferencia, 0);
  assert.equal(resultado.verificacion.fondoReserva.diferencia, 0);
  assert.equal(resultado.verificacion.total.diferencia, 0);
  assert.equal(resultado.detalle.length, 152);
});

test('la restriccion dura se sostiene con cualquier cantidad de unidades', () => {
  for (const cantidad of [1, 2, 3, 7, 13, 40, 99, 152, 301, 500]) {
    const resultado = liquidarPeriodo({
      unidades: unidadesDePrueba(cantidad),
      gastosOrdinarios: [{ id: 'g1', concepto: 'Gasto', montoCentavos: 100_000_01 }],
      fondoReserva: { modo: 'porcentaje', valor: 5 },
    });
    assert.equal(resultado.verificacion.cierra, true, `no cerro con ${cantidad} unidades`);
  }
});

test('los centavos sobrantes se reparten segun la politica elegida', () => {
  const unidades = [
    { id: 'grande', coeficiente: 50 },
    { id: 'media', coeficiente: 30 },
    { id: 'chica', coeficiente: 20 },
  ];
  const gasto = [{ id: 'g1', concepto: 'Gasto', montoCentavos: 1001 }];

  const porResto = liquidarPeriodo({
    unidades, gastosOrdinarios: gasto, politicaRedondeo: POLITICAS_REDONDEO.MAYOR_RESTO,
  });
  const porCoeficiente = liquidarPeriodo({
    unidades, gastosOrdinarios: gasto, politicaRedondeo: POLITICAS_REDONDEO.MAYOR_COEFICIENTE,
  });

  // Las dos cierran, pero no reparten igual: la politica es una decision
  // explicita del complejo, no un detalle de implementacion.
  assert.equal(porResto.verificacion.cierra, true);
  assert.equal(porCoeficiente.verificacion.cierra, true);
  const grandePorCoeficiente = porCoeficiente.detalle.find((d) => d.unidadId === 'grande');
  assert.equal(grandePorCoeficiente.ordinario, 501, 'el centavo sobrante va al mayor coeficiente');
});

test('separa lo que paga el propietario de lo que paga el inquilino', () => {
  const resultado = liquidarPeriodo({
    unidades: [{ id: 'a', coeficiente: 50 }, { id: 'b', coeficiente: 50 }],
    gastosOrdinarios: [{ id: 'g1', concepto: 'Limpieza', montoCentavos: 200_000 }],
    gastosExtraordinarios: [
      { id: 'e1', concepto: 'Impermeabilizacion de terraza', montoCentavos: 400_000, aCargoDe: A_CARGO_DE.PROPIETARIO },
    ],
    fondoReserva: { modo: 'porcentaje', valor: 0 },
  });

  const a = resultado.detalle.find((d) => d.unidadId === 'a');
  assert.equal(a.aCargoOcupante, 100_000, 'el gasto ordinario lo paga quien ocupa');
  assert.equal(a.aCargoPropietario, 200_000, 'la obra extraordinaria la paga el propietario');
  assert.equal(a.aCargoOcupante + a.aCargoPropietario, a.subtotalPeriodo);
});

test('el fondo de reserva se calcula sobre los gastos ordinarios', () => {
  const resultado = liquidarPeriodo({
    unidades: [{ id: 'a', coeficiente: 100 }],
    gastosOrdinarios: [{ id: 'g1', concepto: 'Gasto', montoCentavos: 1_000_000 }],
    gastosExtraordinarios: [{ id: 'e1', concepto: 'Obra', montoCentavos: 5_000_000 }],
    fondoReserva: { modo: 'porcentaje', valor: 8 },
  });
  assert.equal(resultado.totales.fondoReserva, 80_000, 'el 8 % de 10.000, no de 60.000');
});

test('armarCuentaCorriente arrastra saldo anterior e intereses', () => {
  const liquidacion = liquidarPeriodo({
    unidades: [{ id: 'a', coeficiente: 100 }],
    gastosOrdinarios: [{ id: 'g1', concepto: 'Gasto', montoCentavos: 3_245_000 }],
    fondoReserva: { modo: 'porcentaje', valor: 0 },
  });
  const cuenta = armarCuentaCorriente({
    detalleUnidad: liquidacion.detalle[0],
    saldoAnteriorCentavos: 1_000_000,
    interesesMoraCentavos: 35_000,
  });
  assert.equal(cuenta.totalAPagar, 3_245_000 + 1_000_000 + 35_000);
  assert.equal(cuenta.aFavor, 0);
});

test('un saldo a favor grande deja el total en negativo y no se cobra', () => {
  const liquidacion = liquidarPeriodo({
    unidades: [{ id: 'a', coeficiente: 100 }],
    gastosOrdinarios: [{ id: 'g1', concepto: 'Gasto', montoCentavos: 100_000 }],
    fondoReserva: { modo: 'porcentaje', valor: 0 },
  });
  const cuenta = armarCuentaCorriente({
    detalleUnidad: liquidacion.detalle[0],
    saldoAnteriorCentavos: -250_000,
  });
  assert.equal(cuenta.totalAPagar, -150_000);
  assert.equal(cuenta.aFavor, 150_000);
});

test('verificarCierre reporta la diferencia cuando no cierra', () => {
  const resultado = verificarCierre(1000, [300, 300, 300]);
  assert.equal(resultado.cierra, false);
  assert.equal(resultado.diferencia, -100);
});
