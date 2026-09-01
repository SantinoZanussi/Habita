import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const mobile = resolve(raiz, 'mobile');
const configuracion = resolve(mobile, 'firebase.production.json');

if (!existsSync(configuracion)) {
  throw new Error('Falta mobile/firebase.production.json. Copiá firebase.production.example.json y completalo.');
}
if (readFileSync(configuracion, 'utf8').includes('REEMPLAZAR_')) {
  throw new Error('mobile/firebase.production.json todavía contiene valores REEMPLAZAR_.');
}

const flutterComun = 'C:\\flutter\\src\\flutter\\bin\\flutter.bat';
const flutter = existsSync(flutterComun) ? flutterComun : 'flutter';
const resultado = spawnSync(flutter, [
  'build', 'apk', '--release',
  '--dart-define-from-file=firebase.production.json',
], {
  cwd: mobile,
  stdio: 'inherit',
  // En Windows, flutter es un .bat y Node necesita resolverlo mediante cmd.
  shell: process.platform === 'win32',
});

if (resultado.error) throw resultado.error;

process.exit(resultado.status ?? 1);
