import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, ['scripts/check.mjs'], { stdio: 'inherit' });
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function files(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(f => f.isDirectory() ? files(join(dir, f.name), `${prefix}${f.name}/`) : [{ name: `${prefix}${f.name}`, data: readFileSync(join(dir, f.name)) }]);
}
const local = [], central = [];
let offset = 0;
for (const { name, data } of [...files('extension'), { name: 'LICENSE', data: readFileSync('LICENSE') }]) {
  const filename = Buffer.from(name);
  const crc = crc32(data);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6);
  h.writeUInt16LE(33, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(filename.length, 26);
  local.push(h, filename, data);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x800, 8);
  c.writeUInt16LE(33, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(filename.length, 28); c.writeUInt32LE(offset, 42);
  central.push(c, filename); offset += h.length + filename.length + data.length;
}
const index = Buffer.concat(central);
const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
mkdirSync('dist', { recursive: true });
const { version } = JSON.parse(readFileSync('package.json'));
const output = `dist/livros-mais-baratos-pt-${version}.zip`;
writeFileSync(output, Buffer.concat([...local, index, end]));
console.log(output);
