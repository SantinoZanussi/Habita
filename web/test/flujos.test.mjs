import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Ejecuta el controlador real de formularios con transporte aislado.
// Ninguna prueba se conecta a Firebase ni genera pagos reales.
const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const controller = source.slice(source.indexOf('async function enviarModal('), source.indexOf('async function previsualizarPeriodo('));
function escenario() {
  const solicitudes = [];
  const context = vm.createContext({
    estado: { complejoId: 'complejo-a' },
    FormData: class { constructor(form) { return Object.entries(form.values); } },
    $$: (selector, root) => selector === '[data-gasto]' ? root.gastos : Object.entries(root).map(([campo, value]) => ({ dataset: { campo }, value })),
    api: async (ruta, opciones) => { solicitudes.push({ ruta, ...opciones }); return { codigoQr: 'HBA-prueba' }; },
    cerrarModal() {}, mostrarToast() {}, mostrarResultadoAcceso() {},
    mostrarCredencial() {}, cargarResumen() {}, modalGestionObra() {},
  });
  vm.runInContext(controller, context);
  return { solicitudes, enviar: (tipo, values, gastos = []) => context.enviarModal(tipo, { values, gastos, dataset: {} }) };
}

test('varios gastos preservan importe, tipo, reparto y responsable', async () => {
  const e = escenario();
  await e.enviar('periodo', { periodoId: '2026-11', etiqueta: 'Noviembre', vencimiento: '2026-11-10', fondo: '12.34' }, [
    { concepto: ' Limpieza ', monto: '100.25', tipo: 'ordinario', criterio: 'coeficiente', aCargoDe: 'ocupante' },
    { concepto: 'Ascensor', monto: '200.50', tipo: 'extraordinario', criterio: 'partesIguales', aCargoDe: 'propietario' },
  ]);
  const { body } = e.solicitudes[0];
  assert.equal(body.gastosOrdinarios[0].monto, 100.25);
  assert.equal(body.gastosOrdinarios[0].concepto, 'Limpieza');
  assert.equal(body.gastosExtraordinarios[0].monto, 200.5);
  assert.equal(body.gastosExtraordinarios[0].criterio, 'partesIguales');
  assert.equal(body.gastosExtraordinarios[0].aCargoDe, 'propietario');
  assert.equal(body.fondoReserva.valor, 1234);
  assert.equal(e.solicitudes.length, 1);
});

test('el método seleccionado define la validación incluso si el código parece patente', async () => {
  const e = escenario();
  await e.enviar('acceso', { metodo: 'codigo', credencial: 'ABC123', punto: 'entrada', sentido: 'ingreso' });
  assert.equal(e.solicitudes[0].body.codigo, 'ABC123');
  assert.equal(e.solicitudes[0].body.patente, undefined);
  await e.enviar('acceso', { metodo: 'patente', credencial: 'AB123CD', punto: 'entrada', sentido: 'egreso' });
  assert.equal(e.solicitudes[1].body.patente, 'AB123CD');
  assert.equal(e.solicitudes[1].body.sentido, 'egreso');
});

test('autorización conserva restricciones y rechaza vigencia invertida sin escribir', async () => {
  const e = escenario();
  const values = { nombre: 'Visita prueba', documento: '12345678', tipo: 'visita', unidadId: '3a', patente: '', vigenciaDesde: '2026-11-01T09:00', vigenciaHasta: '2026-11-01T18:00', usosPermitidos: '2', punto: 'entrada', dias: 'laborables', horaDesde: '09:00', horaHasta: '18:00' };
  await e.enviar('autorizacion', values);
  assert.equal(e.solicitudes[0].body.usosPermitidos, 2);
  assert.equal(JSON.stringify(e.solicitudes[0].body.diasPermitidos), '[1,2,3,4,5]');
  assert.equal(e.solicitudes[0].body.puntosHabilitados[0], 'entrada');
  assert.equal(e.solicitudes[0].body.vigenciaDesde, new Date(values.vigenciaDesde).toISOString());
  await assert.rejects(e.enviar('autorizacion', { ...values, vigenciaHasta: '2026-10-01T18:00' }));
  assert.equal(e.solicitudes.length, 1);
});

test('obra privada exige unidad y la obra común no envía una unidad residual', async () => {
  const e = escenario();
  await assert.rejects(e.enviar('obra', { tipo: 'privada', unidadId: '' }));
  assert.equal(e.solicitudes.length, 0);
  await e.enviar('obra', { nombre: ' Ascensor ', tipo: 'comun', unidadId: '3a', presupuestoAprobado: '500.25', fechaInicio: '2026-11-01' });
  assert.equal(e.solicitudes[0].body.unidadId, null);
  assert.equal(e.solicitudes[0].body.presupuestoAprobado, 500.25);
});
