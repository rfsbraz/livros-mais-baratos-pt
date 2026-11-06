import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { loadListing, validateListing } from './listing.mjs';

const listing = loadListing();
const manifest = JSON.parse(readFileSync('manifest.json'));
assert.equal(listing.config.name, manifest.name);
assert.equal(listing.config.summary, manifest.description);
assert.deepEqual(validateListing(listing), []);
for (const id of ['chrome', 'firefox', 'edge']) {
  assert(Object.hasOwn(listing.config.stores, id));
}
console.log('Store locales, copy limits and screenshot dimensions validated.');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === 'node_modules' || name === '.git' || name === 'dist') {
      continue;
    }
    const st = statSync(path);
    if (st.isDirectory()) {
      out.push(...walk(path));
    } else if (/\.(md|txt|json|html)$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

const denial =
  /não envia telemetria|sem telemetria|não envia estatísticas de utilização|não envia análise de utilização|Não existe[^\n]{0,40}análise de utilização/i;
const roots = ['PRIVACY.md', 'README.md', 'docs/architecture.md', 'store-listing'];
const offenders = [];
for (const root of roots) {
  const files = statSync(root).isDirectory() ? walk(root) : [root];
  for (const file of files) {
    if (denial.test(readFileSync(file, 'utf8'))) {
      offenders.push(file);
    }
  }
}
assert.deepEqual(offenders, [], `Telemetry denial left in: ${offenders.join(', ')}`);
console.log('Privacy copy no longer denies anonymous performance statistics.');
