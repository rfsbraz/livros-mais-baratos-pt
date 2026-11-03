import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { manifestFor, runtimeFiles } from '../../scripts/build-multi.mjs';
test('browser packages preserve hosts and isolate platform-specific background APIs', () => {
  const source = JSON.parse(readFileSync('manifest.json'));
  for (const browser of ['chrome', 'edge', 'firefox']) {
    const m = manifestFor(browser, source);
    assert.deepEqual(m.host_permissions, source.host_permissions);
    assert.equal(m.version, source.version);
    if (browser === 'firefox') {
      assert.equal(m.background.page, 'background.html');
      assert(!m.permissions.includes('offscreen'));
      assert(m.browser_specific_settings.gecko.id.includes('livros-mais-baratos'));
    } else {
      assert.equal(m.background.service_worker, 'background.js');
      assert(m.permissions.includes('offscreen'));
    }
  }
  assert(runtimeFiles().includes('popup.js'));
  assert(!runtimeFiles().some(f => /test|config|package|store-listing/.test(f)));
});
