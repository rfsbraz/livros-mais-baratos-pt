import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firefoxBackground, manifestFor, runtimeFiles } from '../../scripts/build-multi.mjs';
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
      assert.equal(m.browser_specific_settings.gecko.strict_min_version, '140.0');
      assert.equal(m.browser_specific_settings.gecko_android.strict_min_version, '142.0');
    } else {
      assert.equal(m.background.service_worker, 'background.js');
      assert(m.permissions.includes('offscreen'));
      assert.equal(m.browser_specific_settings, undefined);
    }
  }
  assert(runtimeFiles().includes('popup.js'));
  assert(runtimeFiles().includes('metrics.js'));
  assert(runtimeFiles().includes('metrics-config.js'));
  assert(runtimeFiles().includes('metrics-schema.js'));
  assert(!runtimeFiles().some(f => /(^|\/)(tests?|package|store-listing)/.test(f)));
  const firefox = manifestFor('firefox', source);
  assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions.optional, [
    'technicalAndInteraction'
  ]);
});
test('the Firefox background drops offscreen calls and keeps the parser frame', () => {
  const source = readFileSync('background.js', 'utf8');
  assert.match(source, /chrome\.offscreen\s*\.createDocument/);
  assert.match(source, /chrome\.offscreen\.closeDocument/);
  const built = firefoxBackground(source);
  assert.doesNotMatch(built, /chrome\.offscreen|createDocument|closeDocument|OFFSCREEN_DOCUMENT/);
  assert.match(built, /parser-frame/);
  assert.match(built, /offscreen\.html/);
  assert.match(built, /from "\.\/watch\.js"/);
});
