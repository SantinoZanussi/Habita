import { build } from 'esbuild';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');

await build({
  entryPoints: [resolve(raiz, 'web/src/main.js')],
  bundle: true,
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.SOURCEMAP === 'true',
  format: 'esm',
  target: ['es2022'],
  outfile: resolve(raiz, 'web/assets/js/app.js'),
  define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development') },
  logLevel: 'info',
});
