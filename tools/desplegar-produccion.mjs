import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const proyecto = process.argv.find((a) => a.startsWith('--project='))?.split('=')[1]
  ?? process.env.FIREBASE_PROJECT_ID;

if (!proyecto || proyecto === 'habita-demo') {
  throw new Error('Indicá el proyecto real: npm run deploy:prod -- --project=tu-project-id');
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const firebaseCli = resolve(raiz, 'node_modules/firebase-tools/lib/bin/firebase.js');

ejecutar(npm, ['run', 'verificar']);
ejecutar(process.execPath, [
  firebaseCli, 'deploy', '--project', proyecto,
  '--config', 'firebase/firebase.json',
  '--only', 'auth,functions,hosting,firestore,storage',
  '--message', 'Habita producción',
]);

function ejecutar(comando, argumentos) {
  const resultado = spawnSync(comando, argumentos, {
    cwd: raiz, stdio: 'inherit', shell: false, env: process.env,
  });
  if (resultado.status !== 0) process.exit(resultado.status ?? 1);
}
