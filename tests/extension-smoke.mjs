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
  const cspErrors = []; popup.on('console', message => { if (/inline event handler|Content Security Policy/.test(message.text())) cspErrors.push(message.text()); });
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
  await popup.evaluate(async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.append(svg);
    await new Promise(resolve => setTimeout(resolve, 100));
    svg.setAttribute('onload', 'window.__shopHandlerExecuted = true');
    const text = document.createElement('p'); text.textContent = 'ISBN: 9780306406157'; document.body.append(text);
  });
  cspErrors.length = 0;
  await popup.evaluate(async () => {
    const { pageIsbn } = await import('./parser.js');
    const original = document.body.cloneNode;
    document.body.cloneNode = () => { throw new Error('ISBN detection must not clone active page elements'); };
    try { if (pageIsbn(document) !== '9780306406157') throw new Error('Live-page ISBN missing'); }
    finally { document.body.cloneNode = original; }
    await new Promise(resolve => setTimeout(resolve, 150));
  });
  const extracted = await popup.evaluate(async () => {
    const { pageIsbn } = await import('./parser.js');
    const doc = new DOMParser().parseFromString('<html><body><svg onload="window.__shopHandlerExecuted = true"></svg><img src="https://example.invalid/tracker" onerror="window.__shopHandlerExecuted = true"><nav>ISBN 9780804429573</nav><p>ISBN: <em>9780306406157</em></p></body></html>', 'text/html');
    const isbn = pageIsbn(doc);
    await new Promise(resolve => setTimeout(resolve, 150));
    return { isbn, executed: !!window.__shopHandlerExecuted, originalSvg: doc.querySelector('svg').hasAttribute('onload') };
  });
  assert.equal(extracted.isbn, '9780306406157');
  assert.equal(extracted.executed, false);
  assert.equal(extracted.originalSvg, true, 'extraction must not mutate the source document');
  assert.deepEqual(cspErrors, [], 'reading ISBN text must not activate shop event handlers');
  assert.deepEqual(errors, []);
  console.log('Real Manifest V3 extension loads in Chromium; popup, CSP and native storage verified.');
} finally { await context.close(); }
