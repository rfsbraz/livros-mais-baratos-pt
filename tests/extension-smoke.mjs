import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
await mkdir('work', { recursive: true });
const extension = resolve('extension');
const context = await chromium.launchPersistentContext(resolve('work/chrome-test-profile'), {
  channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
});
try {
  const settings = await context.newPage();
  await settings.goto('chrome://extensions');
  const extensions = await settings.evaluate(() => chrome.developerPrivate.getExtensionsInfo({ includeDisabled: true, includeTerminated: true }));
  const installed = extensions.find(e => e.name === 'Livros Mais Baratos PT');
  assert(installed, 'Chrome must load the real extension manifest');
  assert.equal(installed.state, 'ENABLED');
  assert.equal(installed.manifestErrors.length, 0);
  const popup = await context.newPage();
  const errors = []; popup.on('pageerror', e => errors.push(e.message));
  await popup.goto(`chrome-extension://${installed.id}/popup.html`);
  await popup.getByRole('heading', { name: 'Livros Mais Baratos PT' }).waitFor();
  const state = await popup.evaluate(async () => {
    const permissions = await chrome.permissions.getAll();
    await chrome.storage.local.set({ smokeTest: true });
    const stored = await chrome.storage.local.get('smokeTest');
    await chrome.storage.local.remove('smokeTest');
    return { permissions, stored };
  });
  assert.equal(state.stored.smokeTest, true);
  assert(!state.permissions.origins?.includes('<all_urls>'));
  assert.deepEqual(errors, []);
  console.log('Real Manifest V3 extension loads in Chromium; popup, CSP and native storage verified.');
} finally { await context.close(); }
