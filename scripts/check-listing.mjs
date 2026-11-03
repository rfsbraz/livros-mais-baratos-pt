import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const listing = JSON.parse(readFileSync('store-listing/listing.json'));
const manifest = JSON.parse(readFileSync('manifest.json'));
assert.equal(listing.name, manifest.name);
assert.equal(listing.summary, manifest.description);
for (const id of ['chrome', 'firefox', 'edge']) {
  assert(Object.hasOwn(listing.stores, id));
}
console.log('Store listing configuration validated.');
