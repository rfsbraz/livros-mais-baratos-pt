import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('Release Please manifest matches the published package version', () => {
  const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const released = JSON.parse(readFileSync('.release-please-manifest.json', 'utf8'))['.'];
  assert.equal(
    released,
    packageVersion,
    `O manifesto do Release Please (${released}) deve coincidir com package.json (${packageVersion}).`
  );
});

test('package.json and manifest.json versions stay aligned', () => {
  const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const manifestVersion = JSON.parse(readFileSync('manifest.json', 'utf8')).version;
  assert.equal(
    manifestVersion,
    packageVersion,
    `manifest.json (${manifestVersion}) deve coincidir com package.json (${packageVersion}).`
  );
});

test('version.txt is not kept as a parallel version source', () => {
  assert.equal(
    existsSync('version.txt'),
    false,
    'version.txt was a stale parallel version file; package.json and manifest.json are the sources of truth.'
  );
  const sync = readFileSync('scripts/sync-version.mjs', 'utf8');
  assert.equal(sync.includes('version.txt'), false, 'sync-version must not write version.txt.');
  const releasePlease = JSON.parse(readFileSync('release-please-config.json', 'utf8'));
  const extra = releasePlease.packages['.']['extra-files'] || [];
  assert.equal(
    extra.includes('version.txt'),
    false,
    'release-please must not track version.txt in extra-files.'
  );
});
