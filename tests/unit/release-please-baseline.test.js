import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Release Please manifest matches the published package version', () => {
  const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const released = JSON.parse(readFileSync('.release-please-manifest.json', 'utf8'))['.'];
  assert.equal(
    released,
    packageVersion,
    `O manifesto do Release Please (${released}) deve coincidir com package.json (${packageVersion}).`
  );
});
