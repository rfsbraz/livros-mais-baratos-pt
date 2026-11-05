import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { releaseNotes } from './changelog.mjs';
const version = JSON.parse(readFileSync('package.json')).version;
const released = JSON.parse(readFileSync('.release-please-manifest.json'))['.'];
assert.equal(released, version, 'O PR de versão deve sincronizar o manifesto do Release Please.');
assert(releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version));
console.log(`Versão ${version} e respetivas notas confirmadas.`);
if (process.env.GITHUB_BASE_REF) {
  const base = JSON.parse(
    execFileSync('git', ['show', `origin/${process.env.GITHUB_BASE_REF}:package.json`], {
      encoding: 'utf8'
    })
  ).version;
  const parts = version.split('.').map(Number);
  const previous = base.split('.').map(Number);
  const changed = parts.findIndex((value, index) => value !== previous[index]);
  assert(
    changed >= 0 && parts[changed] > previous[changed],
    `A versão ${version} deve ser superior à versão ${base} da base.`
  );
}
