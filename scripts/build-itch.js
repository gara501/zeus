import { build } from 'vite';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const destination = path.join(root, 'release', 'zeus-path-itch.zip');

// ZIP generation uses Node built-ins, so packaging needs no extra runtime.
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
async function filesIn(directory, prefix = '') {
  const result = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await filesIn(path.join(directory, entry.name), name + '/'));
    else if (entry.isFile()) result.push(name);
    else throw new Error(`Unsupported build entry: ${name}`);
  }
  return result;
}

await build({ root });
const files = await filesIn(dist);
if (!files.includes('index.html')) throw new Error('The build must contain index.html at its root.');
if (files.length > 65535) throw new Error('The build exceeds the ZIP entry limit.');
const localRecords = [], directoryRecords = [];
let offset = 0;
for (const filename of files) {
  const name = Buffer.from(filename, 'utf8');
  const original = await readFile(path.join(dist, ...filename.split('/')));
  const compressed = deflateRawSync(original, { level: 9 });
  const crc = crc32(original);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6); // UTF-8 filenames
  local.writeUInt16LE(8, 8); // DEFLATE
  local.writeUInt16LE(33, 12); // January 1, 1980; reproducible archive timestamps
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(original.length, 22);
  local.writeUInt16LE(name.length, 26);
  localRecords.push(local, name, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(33, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(original.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  directoryRecords.push(central, name);
  offset += local.length + name.length + compressed.length;
  if (offset > 0xffffffff) throw new Error('The build exceeds the ZIP size limit.');
}
const centralDirectory = Buffer.concat(directoryRecords);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralDirectory.length, 12);
end.writeUInt32LE(offset, 16);
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, Buffer.concat([...localRecords, centralDirectory, end]));
console.log(`\nitch.io ZIP ready: ${destination}\n${files.length} files · index.html at the root`);
