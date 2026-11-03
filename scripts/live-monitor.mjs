// Live checks use the shipped adapters in Chromium, never a separate scraper.
import { chromium } from 'playwright';
import { mkdtemp, mkdir, writeFile, rm, cp } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { STORES } from '../extension/stores.js';
const output = resolve('work/store-health.json');
await mkdir('work', { recursive: true });
const report = { schema: 1, checkedAt: new Date().toISOString(), complete: false, results: [] };
const profile = await mkdtemp(join(tmpdir(), 'lmb-monitor-'));
let context;
try {
  const path = join(profile, 'extension');
  await cp('extension', path, { recursive: true });
  await cp('scripts/health-check.mjs', join(path, 'health-check.js'));
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`]
  });
  const page = await context.newPage();
  await page.goto('chrome://extensions');
  const id = await page.evaluate(async () => (await chrome.developerPrivate.getExtensionsInfo({})).find(e => e.name === 'Livros Mais Baratos PT').id);
  // The empty offscreen document lets us import production modules without starting popup comparisons.
  await page.goto(`chrome-extension://${id}/offscreen.html`);
  // Capture only status and known-shop URLs. Never persist page HTML, cookies or headers.
  await page.evaluate(() => {
    window.healthTraffic = [];
    const original = window.fetch.bind(window);
    window.fetch = async (url, options) => {
      const record = { url: String(url), status: null };
      window.healthTraffic.push(record);
      try {
        const response = await original(url, options);
        record.status = response.status;
        return response;
      } catch (error) { record.error = error.name; throw error; }
    };
  });
  for (let offset = 0; offset < STORES.length; offset += 3) {
    const batch = STORES.slice(offset, offset + 3).map(s => s.id);
    const results = await page.evaluate(async ids => {
      const { STORES } = await import('./stores.js');
      const { compareStore, loadPage } = await import('./compare.js');
      const { detectBook, parseOffer } = await import('./parser.js');
      const { inspectOffer, failureCode } = await import('./health-check.js');
      return Promise.all(ids.map(async id => {
        const store = STORES.find(s => s.id === id), attempts = [];
        for (let attempt = 1; attempt <= 2; attempt++) {
          const start = window.healthTraffic.length;
          let check;
          try {
            const result = await compareStore(store, store.sample, AbortSignal.timeout(35000), undefined, store.sampleTitle || '');
            check = inspectOffer(store, result);
            if (check === 'ok') {
              const doc = await loadPage(result.url, AbortSignal.timeout(12000));
              const productUrl = doc.shopUrl || result.url;
              if (detectBook(doc, productUrl).isbn !== store.sample) check = 'page-detection';
              else {
                const offer = parseOffer(doc, store.sample, productUrl);
                check = offer ? inspectOffer(store, { ...offer, url: productUrl, status: 'ok' }) : 'pattern-unverified';
              }
            }
          } catch { check = 'request-failed'; }
          const requests = window.healthTraffic.slice(start).filter(r => {
            try { return new URL(r.url).origin === store.origin; } catch { return false; }
          });
          const status = failureCode(check, requests);
          attempts.push({ status, requests: requests.slice(0, 24) });
          if (status === 'ok') break;
          if (attempt === 1) await new Promise(r => setTimeout(r, 2000));
        }
        return { store: id, name: store.name, isbn: store.sample, url: store.search(store.sample), status: attempts.at(-1).status, attempts };
      }));
    }, batch);
    report.results.push(...results);
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    for (const result of results) console.log(`${result.store}: ${result.status}`);
  }
  report.complete = report.results.length === STORES.length;
} catch (error) {
  report.infrastructureError = `Live checker could not finish (${error.name}). See the workflow log.`;
  console.error(report.infrastructureError);
} finally {
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  await context?.close();
  if (dirname(profile) !== resolve(tmpdir()) || !basename(profile).startsWith('lmb-monitor-')) throw new Error('Unexpected temporary profile path');
  await rm(profile, { recursive: true, force: true });
}
if (!report.complete || report.results.some(r => r.status !== 'ok')) process.exitCode = 1;
