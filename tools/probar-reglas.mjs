import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const javaAndroid = 'C:\\Program Files\\Android\\Android Studio\\jbr';
const entorno = { ...process.env };
if (existsSync(resolve(javaAndroid, 'bin/java.exe'))) {
  entorno.JAVA_HOME = javaAndroid;
  entorno.Path = `${resolve(javaAndroid, 'bin')};${entorno.Path}`;
}

const prueba = 'node --test firebase/tests/*.test.mjs';
const firebaseCli = resolve(raiz, 'node_modules/firebase-tools/lib/bin/firebase.js');
const proceso = spawn(process.execPath, [
  firebaseCli, 'emulators:exec', '--project', 'habita-demo',
  '--config', 'firebase/firebase.json', '--only', 'firestore,storage', prueba,
], { cwd: raiz, stdio: 'inherit', env: entorno });

proceso.on('exit', (codigo) => process.exit(codigo ?? 1));
