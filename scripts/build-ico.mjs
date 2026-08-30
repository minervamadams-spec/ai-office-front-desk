// Builds assets/icon.ico from the iconset PNGs. ICO's modern format can embed PNG data directly per
// entry (no BMP re-encoding needed), so this just writes the ICONDIR/ICONDIRENTRY headers by hand —
// no extra dependency for a one-off asset build.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const iconsetDir = path.join(dir, '..', 'assets', 'icon.iconset');
const sizes = [16, 32, 48, 64, 128, 256];
const sourceForSize = { 16: 'icon_16x16.png', 32: 'icon_32x32.png', 48: 'icon_32x32@2x.png', 64: 'icon_32x32@2x.png', 128: 'icon_128x128.png', 256: 'icon_256x256.png' };

const images = sizes.map((size) => readFileSync(path.join(iconsetDir, sourceForSize[size])));

const headerSize = 6;
const entrySize = 16;
let offset = headerSize + entrySize * images.length;

const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(images.length, 4);

const entries = [];
for (let i = 0; i < images.length; i++) {
  const size = sizes[i];
  const data = images[i];
  const entry = Buffer.alloc(entrySize);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2); // no palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(data.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += data.length;
  entries.push(entry);
}

writeFileSync(path.join(dir, '..', 'assets', 'icon.ico'), Buffer.concat([header, ...entries, ...images]));
console.log('Wrote assets/icon.ico with sizes', sizes.join(', '));
