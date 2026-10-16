import assert from 'node:assert/strict';
import test from 'node:test';
import { registrarAvance } from '../src/servicios/obras.js';

test('avances fuera de rango y fechas inválidas se rechazan antes de escribir', async () => {
  for (const cambios of [{ porcentaje: -1 }, { porcentaje: 101 }, { porcentaje: NaN },
    { timestampCliente: 'nunca' }, { idempotencyKey: 'a/b' }]) {
    await assert.rejects(registrarAvance({ idempotencyKey: 'prueba', porcentaje: 30, ...cambios }), { codigo: 'DATOS_INVALIDOS' });
  }
});
