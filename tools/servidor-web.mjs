import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import './build-web.mjs';

const raiz = resolve(import.meta.dirname, '../web');
const puerto = Number(process.env.PUERTO_WEB ?? 5000);
const tipos = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  let relativa = decodeURIComponent(url.pathname);
  if (relativa === '/') relativa = '/index.html';
  if (relativa === '/panel' || relativa.startsWith('/panel/')) relativa = '/panel/index.html';
  let archivo = normalize(join(raiz, relativa));
  if (!archivo.startsWith(raiz) || !existsSync(archivo) || !(await stat(archivo)).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('No encontrado');
  }
  res.writeHead(200, {
    'Content-Type': tipos[extname(archivo)] ?? 'application/octet-stream',
    'Cache-Control': extname(archivo) === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  createReadStream(archivo).pipe(res);
}).listen(puerto, '127.0.0.1', () => {
  console.log(`Habita web en http://127.0.0.1:${puerto}/panel`);
});

