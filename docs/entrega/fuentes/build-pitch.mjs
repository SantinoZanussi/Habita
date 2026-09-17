import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile, FileBlob } from '@oai/artifact-tool';
import { GlobalFonts } from '@napi-rs/canvas';

// Run the copy in ../.build, whose node_modules points to the bundled runtime.
const workspaceDir = path.resolve(process.env.HABITA_WORKSPACE ?? process.cwd());
const outputDir = path.join(workspaceDir, 'docs/entrega');
const buildDir = path.join(outputDir, '.build');
const SKILL_DIR = process.env.PRESENTATIONS_SKILL_DIR ?? 'C:/Users/user/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const RUNTIME_PYTHON = process.env.RUNTIME_PYTHON ?? 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const edition = process.env.PITCH_EDITION ?? 'Habita_Pitch';
const finalPath = path.join(outputDir, `${edition}.pptx`);
await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(path.join(buildDir, edition), { recursive: true });
for (const [family, filename] of [
  ['Sora', 'Sora/static/Sora-Regular.ttf'], ['Sora', 'Sora/static/Sora-SemiBold.ttf'],
  ['Archivo', 'Archivo/static/Archivo-Regular.ttf'], ['Archivo', 'Archivo/static/Archivo-SemiBold.ttf'],
]) GlobalFonts.registerFromPath(path.join(workspaceDir, 'brand/fonts', filename), family);
const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, 'container_tools/artifact_tool_utils.mjs')).href);
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const C = { navy: '#14395E', dark: '#0C2440', blue: '#3E9BE4', pale: '#E8F3FC', ink: '#16232E', muted: '#5C6D7C', white: '#FFFFFF' };
const fontPolicy = { basis: 'design', families: ['Sora', 'Archivo'] };
const localSource = 'Fuentes del proyecto: docs/PROYECTO_CONTEXTO.md, docs/FASE_2_ENTREGA.md, docs/TAREA_CONTEXTO.md y brand/tokens.json. Estado de proveedores externos: consultar docs/PRODUCCION.md antes de exponer.';
const slides = [];
function txt(slide, text, x, y, w, h, size = 30, opts = {}) {
  const s = slide.shapes.add({ geometry: 'textbox', position: { left: x, top: y, width: w, height: h }, fill: 'none', line: { fill: 'none', width: 0 } });
  s.text = text;
  s.text.style = { typeface: opts.family ?? 'Archivo', fontSize: size, color: opts.color ?? C.ink, bold: opts.bold ?? false, autoFit: 'none', wrap: 'word', verticalAlignment: 'top', insets: { left: 0, right: 0, top: 0, bottom: 0 }, ...opts };
  return s;
}
function slide(title, { dark = false, subtitle = '', notes = '' } = {}) {
  const s = deck.slides.add(); slides.push(s); s.background.fill = dark ? C.dark : C.white;
  if (title) txt(s, title, 72, 52, 1136, 104, 46, { family: 'Sora', bold: true, color: dark ? C.white : C.navy });
  if (subtitle) txt(s, subtitle, 74, 157, 1125, 70, 27, { color: dark ? C.pale : C.muted });
  txt(s, String(slides.length).padStart(2, '0'), 1160, 660, 48, 28, 18, { color: dark ? C.pale : C.muted });
  s.speakerNotes.textFrame.setText(`${notes}\n\n${localSource}`);
  return s;
}
async function pic(s, asset, x, y, w, h, alt) {
  s.images.add({ blob: new Uint8Array(await fs.readFile(asset)), contentType: 'image/png', fit: 'contain', position: { left: x, top: y, width: w, height: h }, alt });
}
function table(s, values, x, y, w, h, widths, size = 27) {
  const t = s.tables.add({ rows: values.length, columns: values[0].length, left: x, top: y, width: w, height: h, columnWidths: widths, values });
  t.borders.assign({ fill: C.white, width: 2, style: 'solid' });
  for (let r = 0; r < values.length; r++) for (let c = 0; c < values[r].length; c++) {
    const cell = t.getCell(r, c); cell.fill = r === 0 ? C.navy : (r % 2 ? C.pale : '#F7FAFC');
    cell.text.style = { typeface: 'Archivo', fontSize: size, color: r === 0 ? C.white : C.ink, bold: r === 0 || c === 0, autoFit: 'none' };
  }
  return t;
}

// 01. Cover with original brand artwork, preserved in its original proportion.
{
 const s = slide('', { notes: 'Apertura, 20 segundos. Habita reúne el trabajo de la administración y la experiencia del residente en el mismo sistema. Presentar los nombres del equipo oralmente. Esta es una propuesta de producto y una entrega académica, sin clientes comerciales validados que informar.' });
 txt(s, 'Habita', 72, 188, 640, 100, 84, { family: 'Sora', bold: true, color: C.navy });
 txt(s, 'Un solo sistema para\ntodo tu complejo', 76, 304, 650, 150, 42, { family: 'Sora', color: C.navy });
 txt(s, 'App móvil y panel de administración', 78, 532, 650, 58, 28, { color: C.muted });
 await pic(s, path.join(workspaceDir, 'brand/logos/habita-logotipo.png'), 775, 120, 420, 420, 'Logotipo original de Habita');
}
// 02. Problem stated as a working business hypothesis, not external research.
{
 const s = slide('La operación queda fragmentada', { dark: true, subtitle: 'Problema que busca resolver el proyecto', notes: '35 segundos. El contexto del proyecto parte de administraciones que usan mensajes, planillas y registros en papel. Esto es la hipótesis del problema, no el resultado de entrevistas o una medición de mercado. Contar un caso: un residente reclama una pérdida y luego debe preguntar por mensaje si alguien la atendió.' });
 txt(s, 'Mensajes', 74, 254, 380, 58, 40, { family: 'Sora', color: C.blue });
 txt(s, 'Reclamos sin seguimiento compartido', 470, 256, 700, 76, 32, { color: C.white });
 txt(s, 'Planillas', 74, 373, 380, 58, 40, { family: 'Sora', color: C.blue });
 txt(s, 'Saldos y liquidaciones en archivos separados', 470, 376, 700, 85, 32, { color: C.white });
 txt(s, 'Garita', 74, 506, 380, 58, 40, { family: 'Sora', color: C.blue });
 txt(s, 'Ingresos difíciles de consultar y auditar', 470, 510, 700, 85, 32, { color: C.white });
}
// 03. Buyer/user distinction.
{
 const s = slide('Cliente y usuarios', { subtitle: 'La administración contrata. Cada persona usa su vista.', notes: '35 segundos. El cliente objetivo son administradoras y complejos autoadministrados. Los usuarios son residentes, guardias, responsables de obra y administradores. Mostrar que una interfaz única para todos expondría información innecesaria y dificultaría tareas concretas. No afirmar que ya existen contratos o clientes activos.' });
 table(s, [['Perfil', 'Necesidad que cubre Habita'], ['Administración', 'Liquidar, cobrar y seguir la operación del complejo'], ['Residente', 'Consultar su cuenta, autorizar visitas y hacer reclamos'], ['Guardia', 'Validar ingresos con permisos y registrar el resultado'], ['Responsable de obra', 'Cargar avances de las obras que tiene asignadas']], 74, 256, 1132, 335, [315, 817], 27);
}
// 04. Product evidence, with honest fallback.
{
 const mobile = path.join(outputDir, 'assets/app-real.png');
 const panel = path.join(outputDir, 'assets/panel-real.png');
 const exists = async p => fs.access(p).then(() => true, () => false);
 const real = await exists(mobile) && await exists(panel);
 const s = slide('Dos vistas, la misma información', { subtitle: real ? 'Capturas de la aplicación y del panel con datos de demostración' : 'Referencia visual del producto', notes: real ? '45 segundos. Son capturas reales del sistema con datos de prueba. El tiempo real se demuestra con una acción durante la demo, no mediante una captura fija.' : '45 segundos. Esta imagen es el mockup original del repositorio, no una captura de una ejecución. Mostrar la app y el panel reales durante la demo. El script reemplaza esta referencia automáticamente cuando existen assets/app-real.png y assets/panel-real.png.' });
 if (real) {
  await pic(s, panel, 72, 250, 825, 386, 'Panel real de Habita con datos de demostración');
  await pic(s, mobile, 948, 218, 244, 425, 'App real de Habita con datos de demostración');
 } else {
  await pic(s, path.join(workspaceDir, 'brand/mockups/diseno-app.png'), 285, 218, 710, 435, 'Mockup de referencia original, no captura de ejecución');
  txt(s, 'Mockup original. La demo muestra el sistema en ejecución.', 75, 653, 1030, 34, 20, { color: C.muted });
 }
}
// 05. Brand system.
{
 const s = slide('Una identidad común', { notes: '30 segundos. El isotipo entregado combina una H con edificios y una vivienda. La misma identidad se usa en móvil y web. Sora organiza los títulos y Archivo sostiene lectura y formularios. Los colores de estado se acompañan con texto. La paleta viene de brand/tokens.json y alimenta ambos clientes.' });
 await pic(s, path.join(workspaceDir, 'brand/logos/habita-isotipo.png'), 80, 227, 350, 350, 'Isotipo original de Habita');
 txt(s, 'Sora', 516, 226, 600, 79, 64, { family: 'Sora', bold: true, color: C.navy });
 txt(s, 'Títulos y cifras principales', 522, 314, 660, 51, 28, { color: C.muted });
 txt(s, 'Archivo', 518, 396, 620, 75, 58, { color: C.ink });
 txt(s, 'Lectura, tablas y formularios', 522, 475, 660, 52, 28, { color: C.muted });
 txt(s, '#14395E    #3E9BE4    #E8F3FC', 522, 570, 650, 52, 30, { family: 'Sora', color: C.navy });
}
// 06. Architecture as an editable evidence table.
{
 const s = slide('Arquitectura compartida', { subtitle: 'Las lecturas son reactivas. El servidor aplica las reglas de negocio.', notes: '50 segundos. Flutter usa snapshots y el panel usa onSnapshot sobre el mismo Firestore. Las operaciones sensibles llaman al backend con el token de Firebase Auth. Node valida rol y complejo, calcula y escribe con Admin SDK. Las reglas de Firestore protegen las lecturas y bloquean escrituras directas que no corresponden. Los secretos de proveedores quedan en el servidor.' });
 table(s, [['Componente', 'Responsabilidad'], ['Flutter y panel web', 'Interfaz según rol y lectura de cambios en tiempo real'], ['Firebase Auth y Firestore', 'Identidad, permisos por complejo y datos compartidos'], ['Node.js con Express', 'Liquidaciones, transacciones y escrituras sensibles'], ['Proveedores externos', 'Checkout, clasificación de reclamos y notificaciones']], 74, 249, 1132, 330, [374, 758], 27);
 txt(s, 'Un mismo modelo configura edificios, consorcios, barrios y countries.', 76, 605, 1110, 63, 27, { color: C.navy });
}
// 07. Concrete editable numerical explanation, explicit sample.
{
 const s = slide('Liquidaciones que cierran al centavo', { dark: true, subtitle: 'El motor calcula en centavos enteros y reparte el resto de forma explícita.', notes: '45 segundos. Ejemplo didáctico: 100 pesos entre tres unidades de igual coeficiente. El reparto necesita asignar el centavo restante, por eso devuelve 33,34, 33,33 y 33,33. No representa una liquidación real. En el sistema también hay ordinarios, extraordinarios, reserva e imputación de pagos. Mostrar después una liquidación demo y comparar su total con la suma por unidad.' });
 txt(s, '$100,00', 73, 257, 1070, 121, 88, { family: 'Sora', bold: true, color: C.white });
 txt(s, 'Ejemplo: tres unidades con igual coeficiente', 80, 388, 1100, 52, 30, { color: C.pale });
 txt(s, '$33,34  +  $33,33  +  $33,33', 74, 498, 1128, 91, 54, { family: 'Sora', color: C.white });
 txt(s, 'Total distribuido: $100,00', 80, 613, 1080, 46, 29, { color: C.pale });
}
// 08. Other differentiated core logic.
{
 const s = slide('Control y seguimiento', { notes: '45 segundos. En accesos, consumir el uso y escribir el evento ocurre en una transacción. Dos guardias no deberían consumir el último uso dos veces. Los clientes no pueden editar el historial. En reclamos, el servicio devuelve área, urgencia y confianza. La administración puede corregir la clasificación. Una respuesta de fallback debe distinguirse de una llamada real a Gemini.' });
 txt(s, 'Accesos', 76, 240, 500, 70, 43, { family: 'Sora', bold: true, color: C.navy });
 txt(s, 'Vigencia y cantidad de usos\n\nConsumo transaccional\n\nHistorial inmutable', 78, 338, 492, 276, 31);
 txt(s, 'Reclamos', 677, 240, 525, 70, 43, { family: 'Sora', bold: true, color: C.navy });
 txt(s, 'Clasificación por área y urgencia\n\nConfianza visible\n\nCorrección de la administración', 679, 338, 520, 276, 31);
}
// 09. API integration versus external verification is explicit.
{
 const s = slide('APIs con una función concreta', { subtitle: 'El backend conecta cada servicio y conserva sus credenciales.', notes: '40 segundos. Mercado Pago genera checkout y confirma pagos por webhook. Gemini clasifica reclamos. FCM envía avisos al dispositivo. BCRA y Maps son extensiones del contexto. Revisar el reporte operativo antes de exponer: una simulación de pago no acredita una transacción externa, y una clasificación local no prueba Gemini. No mostrar secretos, tokens ni credenciales en la presentación.' });
 table(s, [['Servicio', 'Uso dentro de Habita'], ['Mercado Pago', 'Checkout e imputación de pagos confirmados'], ['Gemini', 'Clasificación de reclamos por área y urgencia'], ['Firebase Cloud Messaging', 'Avisos de la administración y eventos al celular']], 75, 251, 1130, 279, [400, 730], 28);
 txt(s, 'La integración implementada requiere pruebas externas registradas.\nUn pago simulado no demuestra un cobro de Mercado Pago.', 78, 568, 1118, 94, 26, { color: C.muted });
}
// 10. Commercial proposal without fabricated prices/traction.
{
 const s = slide('Modelo de negocio', { subtitle: 'Propuesta de cobro por unidad por mes. Precio a cotizar.', notes: '40 segundos. Son planes propuestos en el contexto del proyecto, no contratos vendidos. Base cubre consorcios y edificios. Barrio agrega la operación de barrios y obras. Cartera apunta a administradoras con varios complejos. Los valores deben validarse con clientes y costos operativos antes de fijar una tarifa. La evaluación de ingresantes existe como API y aún no tiene una pantalla dedicada.' });
 table(s, [['Plan', 'Cliente objetivo', 'Alcance propuesto'], ['Base', 'Edificios y consorcios', 'Accesos, amenities, reclamos, expensas y pagos'], ['Barrio', 'Barrios y countries', 'Base, patentes, varios accesos y obras'], ['Cartera', 'Administradoras', 'Varios complejos, evaluación y soporte prioritario']], 74, 256, 1132, 324, [177, 338, 617], 27);
 txt(s, 'Hipótesis comercial pendiente de validar con administradoras.', 78, 613, 1075, 48, 26, { color: C.muted });
}
// 11. Process stages and actual external boundaries.
{
 const s = slide('Proceso de desarrollo y entrega', { notes: '45 segundos. Explicar decisiones y cambios reales con el historial del repositorio. La documentación existente cubre producto, identidad e implementación de fase 2. La preparación de QA no reemplaza el testeo con otro grupo. La fase 4 depende de corregir sus hallazgos y registrar una demo. El pitch y guion apoyan la exposición de fase 5. Completar los nombres del equipo y las fechas de clase oralmente sin inventar una cronología de actividades.' });
 const rows = [
  ['01', 'Producto y marca', 'Concepto, perfiles y sistema visual compartido'],
  ['02', 'Desarrollo', 'App, panel, backend, Firebase e integraciones'],
  ['03', 'QA cruzado', 'Guía preparada. Otro grupo debe ejecutarla.'],
  ['04', 'Corrección y lanzamiento', 'Corregir hallazgos y comprobar landing y demo'],
  ['05', 'Exposición', 'Pitch y guion listos para ensayo y defensa'],
 ];
 rows.forEach(([n,h,b],i) => { const y=213+i*87; txt(s,n,76,y,85,52,32,{family:'Sora',color:C.blue}); txt(s,h,184,y,415,53,30,{bold:true,color:C.navy}); txt(s,b,616,y,577,67,27); });
}
// 12. Demonstration order and clear close.
{
 const s = slide('La demo en vivo', { dark: true, subtitle: 'Una acción en el celular tiene que verse en el panel.', notes: 'Cierre del pitch, 20 segundos, seguido de demo de 3 minutos. 1. Crear visita de un uso y registrar acceso con guardia. Mostrarlo en panel y rechazar reutilización. 2. Previsualizar y cerrar un período de prueba. Mostrar cierre exacto y actualización en residente. 3. Cambiar avance de una partida de obra y observar fecha estimada. Si un flujo falla, explicar el error y usar el video real de respaldo. El documento GUION_PRESENTACION_DEMO.md detalla preparación y alternativas sin simular evidencia externa.' });
 txt(s, '01   Visita y validación de acceso', 77, 267, 1115, 74, 38, { family: 'Sora', color: C.white });
 txt(s, '02   Liquidación y cuenta del residente', 77, 380, 1115, 80, 38, { family: 'Sora', color: C.white });
 txt(s, '03   Avance y fecha estimada de obra', 77, 493, 1115, 80, 38, { family: 'Sora', color: C.white });
 txt(s, 'Escenario de prueba. QA cruzado y validaciones externas se registran aparte.', 80, 619, 1085, 44, 23, { color: C.pale });
}

const candidatePath = path.join(buildDir, `${edition}.candidate.pptx`);
await (await PresentationFile.exportPptx(deck)).save(candidatePath);
const result = await finalizePresentation({
 workspaceDir, candidatePath, finalPath, pythonExecutable: RUNTIME_PYTHON,
 integrityValidatorPath: path.join(SKILL_DIR, 'container_tools/inspect_presentation_package_integrity.py'),
 layoutValidatorPath: path.join(SKILL_DIR, 'container_tools/inspect_presentation_layout_geometry.py'),
 layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit'],
 explicitTotalSlideCount: 12, requiredNativeTableOwnerSlides: [3, 6, 9, 10], requiredNativeChartOwnerSlides: [],
 fontPolicy, verifyArtifactToolImport: true, receiptPath: path.join(buildDir, `${edition}.validation.json`),
});
console.log(JSON.stringify(result));
// Render the finalized output, not merely the in-memory draft.
const finalDeck = await PresentationFile.importPptx(await FileBlob.load(finalPath));
for (let i = 0; i < slides.length; i++) {
 const rendered = await finalDeck.export({ slide: finalDeck.slides.getItem(i), format: 'png', scale: 1.5 });
 await fs.writeFile(path.join(buildDir, edition, `slide-${String(i+1).padStart(2,'0')}.png`), new Uint8Array(await rendered.arrayBuffer()));
 console.log(`Rendered ${i+1}/${slides.length}`);
}
await fs.writeFile(path.join(buildDir, `${edition}.inspect.jsonl`), (await finalDeck.inspect({ kind: 'slide,textbox,table,notes', maxChars: 100000 })).ndjson);
console.log(`Final: ${finalPath}`);
