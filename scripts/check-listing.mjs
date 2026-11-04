import { readFileSync } from 'node:fs';
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
