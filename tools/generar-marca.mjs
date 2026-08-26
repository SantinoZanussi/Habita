/** Copia los assets fuente de marca a las dos aplicaciones. */

import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destinos = [
  ['brand/logos/habita-isotipo.svg', 'web/assets/brand/habita-isotipo.svg'],
  ['brand/logos/habita-isotipo.png', 'web/assets/brand/habita-isotipo.png'],
  ['brand/logos/habita-logotipo.png', 'web/assets/brand/habita-logotipo.png'],
  ['brand/mockups/diseno-app.png', 'web/assets/brand/diseno-app.png'],
  ['brand/logos/habita-isotipo.png', 'mobile/assets/brand/habita-isotipo.png'],
  ['brand/logos/habita-logotipo.png', 'mobile/assets/brand/habita-logotipo.png'],
  ['brand/fonts/Sora/Sora-VariableFont_wght.ttf', 'web/assets/fonts/Sora-Variable.ttf'],
  ['brand/fonts/Archivo/Archivo-VariableFont_wdth,wght.ttf', 'web/assets/fonts/Archivo-Variable.ttf'],
  ['brand/fonts/Sora/Sora-VariableFont_wght.ttf', 'mobile/assets/fonts/Sora-Variable.ttf'],
  ['brand/fonts/Archivo/Archivo-VariableFont_wdth,wght.ttf', 'mobile/assets/fonts/Archivo-Variable.ttf'],
];

for (const [origen, destino] of destinos) {
  const absoluto = resolve(raiz, destino);
  await mkdir(dirname(absoluto), { recursive: true });
  await cp(resolve(raiz, origen), absoluto);
}

console.log(`Marca preparada: ${destinos.length} assets.`);

