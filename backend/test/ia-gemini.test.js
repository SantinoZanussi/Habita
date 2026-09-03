import assert from 'node:assert/strict';
import test from 'node:test';

process.env.IA_PROVEEDOR = 'gemini';
process.env.GEMINI_API_KEY = 'clave-de-prueba';
process.env.IA_MODELO = 'gemini-prueba';
process.env.IA_URL_BASE = 'https://gemini.invalid/v1beta';

const { clasificarReclamo } = await import('../src/externos/ia.js');

test('Gemini clasifica con JSON estructurado y ante una respuesta inválida usa el respaldo', async (t) => {
  const fetchOriginal = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetchOriginal; });

  let peticion;
  globalThis.fetch = async (url, opciones) => {
    peticion = { url, opciones };
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              area: 'plomeria',
              urgencia: 'alta',
              confianza: 91,
              resumen: 'Pérdida activa debajo de la pileta',
              accionSugerida: 'Cerrar la llave de paso y enviar un plomero.',
              requiereIngresoProveedor: true,
            }),
          }],
        },
      }],
      usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 25 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const resultado = await clasificarReclamo({
    descripcion: 'Hay una pérdida fuerte de agua debajo de la pileta.',
  });

  assert.equal(resultado.origen, 'ia');
  assert.equal(resultado.proveedor, 'gemini');
  assert.equal(resultado.area, 'plomeria');
  assert.equal(resultado.tokens.entrada, 40);
  assert.match(peticion.url, /gemini-prueba:generateContent$/);
  assert.equal(peticion.opciones.headers['x-goog-api-key'], 'clave-de-prueba');
  const cuerpo = JSON.parse(peticion.opciones.body);
  assert.equal(cuerpo.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(cuerpo.generationConfig.responseJsonSchema.properties.area.enum, [
    'plomeria', 'electricidad', 'seguridad', 'limpieza', 'estructura',
    'climatizacion', 'ascensores', 'espacios_comunes', 'otro',
  ]);

  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: '{"area":"inventada"}' }] } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const respaldo = await clasificarReclamo({
    descripcion: 'Hay olor a gas en el pasillo.',
  });
  assert.equal(respaldo.origen, 'palabras_clave');
  assert.equal(respaldo.area, 'plomeria');
  assert.equal(respaldo.urgencia, 'critica');
});
