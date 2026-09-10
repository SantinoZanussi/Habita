// Comprobación de solo lectura: no crea usuarios ni pagos y no usa secretos.
const api = (process.env.HABITA_API_URL ?? 'https://habita-api-goiburu.onrender.com/api').replace(/\/$/, '');
const panel = process.env.HABITA_PANEL_URL ?? 'https://habita-complejos-goiburu.web.app/panel/';
const landing = process.env.HABITA_LANDING_URL ?? new URL('/', panel).href;
const origen = new URL(panel).origin;

async function consultar(url, opciones = {}) {
  const respuesta = await fetch(url, { ...opciones, signal: AbortSignal.timeout(55_000) });
  return { respuesta, contenido: await respuesta.text() };
}

try {
  const [salud, estado, acceso, sitio, portada] = await Promise.all([
    consultar(`${api}/salud`),
    consultar(`${api}/estado`, { headers: { Origin: origen } }),
    consultar(`${api}/usuarios/me`),
    consultar(panel),
    consultar(landing),
  ]);
  const datosSalud = JSON.parse(salud.contenido);
  const datosEstado = JSON.parse(estado.contenido);
  const controles = {
    backend: salud.respuesta.ok && datosSalud.estado === 'ok',
    firestore: estado.respuesta.ok && datosEstado.firestore?.estado === 'ok' && datosEstado.firestore?.emulador === false,
    produccion: datosEstado.modo === 'production',
    landing: portada.respuesta.ok && portada.contenido.includes('Todo tu complejo'),
    panel: sitio.respuesta.ok && sitio.contenido.includes('<html'),
    cors: estado.respuesta.headers.get('access-control-allow-origin') === origen,
    sesionObligatoria: acceso.respuesta.status === 401,
  };
  for (const [nombre, correcto] of Object.entries(controles)) {
    console.log(`${correcto ? 'OK' : 'ERROR'} ${nombre}`);
  }
  for (const nombre of ['mercadoPago', 'ia', 'fcm', 'maps', 'bcra']) {
    console.log(`${nombre}: ${datosEstado.integraciones?.[nombre] ?? 'desconocido'}`);
  }
  console.log('Los estados de integración indican configuración, no una prueba de cobro, IA o entrega push.');
  if (datosEstado.integraciones?.mercadoPago === 'simulado') {
    console.log('PENDIENTE: Mercado Pago externo. La demo no mueve dinero real.');
  }
  if (Object.values(controles).some((correcto) => !correcto)) process.exitCode = 1;
} catch (error) {
  console.error(`No se pudo completar la comprobación: ${error.name}. Revisá conectividad o el arranque de Render Free.`);
  process.exitCode = 1;
}
