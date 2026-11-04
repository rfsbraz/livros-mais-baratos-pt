import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { CATALOGUE, STORES } from '../stores.js';
const manifest = JSON.parse(readFileSync('manifest.json'));
const pkg = JSON.parse(readFileSync('package.json'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version);
assert.deepEqual(manifest.permissions, [
  'activeTab',
  'scripting',
  'storage',
  'offscreen',
  'alarms',
  'notifications'
]);
assert.equal(manifest.background.service_worker, 'background.js');
assert.equal(manifest.background.type, 'module');
assert(
  !manifest.content_scripts,
  'Dynamic scripts must respect the saved off switch and shop selection'
);
assert(!manifest.optional_host_permissions, 'Shop access is requested at installation');
assert.equal(new Set(CATALOGUE.map(s => s.id)).size, CATALOGUE.length, 'Store IDs must be unique');
assert.deepEqual(manifest.host_permissions.sort(), STORES.map(s => `${s.origin}/*`).sort());
for (const group of manifest.web_accessible_resources) {
  assert.deepEqual([...group.matches].sort(), STORES.map(s => `${s.origin}/*`).sort());
  for (const file of group.resources) {
    assert(existsSync(`${file}`), `Missing content module ${file}`);
  }
}
for (const path of Object.values(manifest.icons)) {
  assert(existsSync(`${path}`), `Missing icon ${path}`);
}
for (const file of readdirSync('.').filter(f => f.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', `${file}`]);
  const source = readFileSync(`${file}`, 'utf8');
  assert(!/\beval\s*\(|\.innerHTML\s*=/.test(source), `Unsafe execution or rendering in ${file}`);
}
console.log('Manifest, versions, permissions, icons and JavaScript checks passed.');
