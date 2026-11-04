// Optional network check. Runs private source only in a local Chromium extension context.
// The production manifest already declares the configured shop hosts.
import { chromium } from 'playwright';
import { cp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
await mkdir('work/live-extension', { recursive: true });
await cp('dist/chrome', 'work/live-extension', { recursive: true });
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
await writeFile('work/live-extension/manifest.json', JSON.stringify(manifest));
const path = resolve('work/live-extension');
const context = await chromium.launchPersistentContext(resolve('work/live-profile'), {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`]
});
try {
  const page = await context.newPage();
  await page.goto('chrome://extensions');
  const id = await page.evaluate(
    async () =>
      (await chrome.developerPrivate.getExtensionsInfo({})).find(
        e => e.name === 'Livros Mais Baratos PT'
      ).id
  );
  await page.goto(`chrome-extension://${id}/popup.html`);
  const results = await page.evaluate(async ids => {
    const { STORES } = await import('./core.js');
    const { compareStore, pooled } = await import('./compare.js');
    return pooled(
      STORES.filter(store => !ids.length || ids.includes(store.id)),
      async store => {
        const isbn = store.sample;
        const result = await compareStore(
          store,
          isbn,
          AbortSignal.timeout(35000),
          undefined,
          store.sampleTitle || ''
        );
        return {
          store: store.id,
          isbn,
          status: result.status,
          price: result.price,
          currency: result.currency,
          condition: result.condition,
          title: result.title,
          url: result.url
        };
      }
    );
  }, process.argv.slice(2));
  console.log(JSON.stringify(results, null, 2));
  await writeFile(
    `work/live-results${process.argv.length > 2 ? '-additional' : ''}.json`,
    JSON.stringify({ at: new Date().toISOString(), results }, null, 2)
  );
} finally {
  await context.close();
}
