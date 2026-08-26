// Muestreo de color sin dependencias: decodifica un PNG (RGB/RGBA, 8 bits) con zlib.
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

function decodePng(path) {
  const buf = readFileSync(path);
  let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('bitDepth ' + bitDepth + ' no soportado');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('colorType ' + colorType + ' no soportado');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels, stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
    cur.copy(out, y * stride); prev = cur;
  }
  return { width, height, channels, data: out };
}

const img = decodePng(process.argv[2]);
const hex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');
const at = (xf, yf) => {
  const x = Math.round(xf * (img.width - 1)), y = Math.round(yf * (img.height - 1));
  const i = (y * img.width + x) * img.channels;
  return hex(img.data[i], img.data[i + 1], img.data[i + 2]);
};
console.log(img.width + 'x' + img.height, 'canales:', img.channels);
for (const [name, x, y] of JSON.parse(process.argv[3])) console.log(name.padEnd(22), at(x, y));
