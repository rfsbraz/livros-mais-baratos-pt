// Optional network check. Runs private source only in a local Chromium extension context.
// The temporary test manifest pre-grants the same four hosts to avoid headless prompts.
import { chromium } from 'playwright';
import { cp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
await mkdir('work/live-extension', { recursive: true });
await cp('extension', 'work/live-extension', { recursive: true });
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
manifest.host_permissions = manifest.optional_host_permissions;
delete manifest.optional_host_permissions;
await writeFile('work/live-extension/manifest.json', JSON.stringify(manifest));
const path = resolve('work/live-extension');
const context = await chromium.launchPersistentContext(resolve('work/live-profile'), {
  channel: 'chromium', headless: true, args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`]
});
try {
  const page = await context.newPage(); await page.goto('chrome://extensions');
  const id = await page.evaluate(async () => (await chrome.developerPrivate.getExtensionsInfo({})).find(e => e.name === 'Livros Mais Baratos PT').id);
  await page.goto(`chrome-extension://${id}/popup.html`);
  const results = await page.evaluate(async () => {
    const { STORES } = await import('./core.js');
    const { compareStore } = await import('./compare.js');
    return Promise.all(STORES.map(async store => {
      const isbn = store.id === 'bookcover' ? '9789899267411' : '9789895701124';
      const result = await compareStore(store, isbn, new AbortController().signal);
      return { store: store.id, isbn, status: result.status, price: result.price, title: result.title, url: result.url };
    }));
  });
  console.log(JSON.stringify(results, null, 2));
  await writeFile('work/live-results.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
} finally { await context.close(); }
