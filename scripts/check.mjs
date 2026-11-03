import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const manifest = JSON.parse(readFileSync('extension/manifest.json'));
const pkg = JSON.parse(readFileSync('package.json'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version);
assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage']);
assert(!manifest.host_permissions, 'Store access must remain optional');
for (const path of Object.values(manifest.icons)) assert(existsSync(`extension/${path}`), `Missing icon ${path}`);
for (const file of readdirSync('extension').filter(f => f.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', `extension/${file}`]);
  const source = readFileSync(`extension/${file}`, 'utf8');
  assert(!/\beval\s*\(|\.innerHTML\s*=/.test(source), `Unsafe execution or rendering in ${file}`);
}
console.log('Manifest, versions, permissions, icons and JavaScript checks passed.');
