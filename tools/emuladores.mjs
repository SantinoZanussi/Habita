import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const javaAndroid = 'C:\\Program Files\\Android\\Android Studio\\jbr';
if (existsSync(resolve(javaAndroid, 'bin/java.exe'))) {
  process.env.JAVA_HOME = javaAndroid;
  process.env.Path = `${resolve(javaAndroid, 'bin')};${process.env.Path}`;
}

const firebaseCli = resolve(raiz, 'node_modules/firebase-tools/lib/bin/firebase.js');
const proceso = spawn(process.execPath, [
  firebaseCli, 'emulators:start', '--project', 'habita-demo',
  '--config', 'firebase.json', '--import', 'emulador-datos',
  '--export-on-exit', 'emulador-datos',
], { cwd: raiz, stdio: 'inherit', env: process.env });

proceso.on('exit', (codigo) => process.exit(codigo ?? 0));
