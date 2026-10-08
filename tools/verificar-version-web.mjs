// Solo lectura: compara el sitio publicado con los archivos de este checkout.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '../web');
const sitio = new URL('/', process.env.HABITA_PANEL_URL ?? 'https://habita-complejos-goiburu.web.app/panel/');
const archivos = ['index.html', 'panel/index.html', 'assets/css/app.css', 'assets/js/app.js'];
const digest = (texto) => createHash('sha256').update(texto.replace(/\r\n/g, '\n')).digest('hex');

const resultados = await Promise.all(archivos.map(async (archivo) => {
  try {
    const [local, respuesta] = await Promise.all([
      readFile(resolve(raiz, archivo), 'utf8'),
      fetch(new URL(archivo, sitio), { cache: 'no-store', signal: AbortSignal.timeout(55_000) }),
    ]);
    if (!respuesta.ok) return { archivo, correcto: false, motivo: `HTTP ${respuesta.status}` };
    const publicado = await respuesta.text();
    const correcto = digest(local) === digest(publicado);
    return { archivo, correcto, motivo: correcto ? '' : 'contenido diferente' };
  } catch (error) {
    return { archivo, correcto: false, motivo: error.name };
  }
}));

for (const { archivo, correcto, motivo } of resultados) {
  console.log(`${correcto ? 'OK' : 'ERROR'} version ${archivo}${motivo ? `: ${motivo}` : ''}`);
}
console.log('Compara HTML, CSS y bundle web. No verifica el commit de Render, una sesión ni integraciones externas.');
if (resultados.some((r) => !r.correcto)) process.exitCode = 1;
