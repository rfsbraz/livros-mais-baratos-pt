// Live checks use the shipped adapters in Chromium, never a separate scraper.
import { chromium } from 'playwright';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { selectedStores } from './health-schedule.mjs';
import { setTimeout as sleep } from 'node:timers/promises';
import { randomInt } from 'node:crypto';
const output = resolve('work/store-health.json');
await mkdir('work', { recursive: true });
const plan = process.env.HEALTH_PLAN
  ? JSON.parse(await readFile(process.env.HEALTH_PLAN, 'utf8'))
  : null;
const plannedStores = plan ? selectedStores(plan.stores) : selectedStores(process.argv.slice(2));
const report = {
  schema: 2,
  checkedAt: new Date().toISOString(),
  plannedStores,
  complete: false,
  results: []
};
const profile = await mkdtemp(join(tmpdir(), 'lmb-monitor-'));
let context;
try {
  const path = join(profile, 'extension');
  await cp('dist/chrome', path, { recursive: true });
  await cp('scripts/health-check.mjs', join(path, 'health-check.js'));
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`]
  });
  const page = await context.newPage();
  await page.goto('chrome://extensions');
  const id = await page.evaluate(
    async () =>
      (await chrome.developerPrivate.getExtensionsInfo({})).find(
        e => e.name === 'Livros Mais Baratos PT'
      ).id
  );
  // The empty offscreen document lets us import production modules without starting popup comparisons.
  await page.goto(`chrome-extension://${id}/offscreen.html`);
  // Capture only status and known-shop URLs. Never persist page HTML, cookies or headers.
  await page.evaluate(async () => {
    const { retryAfterUntil } = await import('./health-check.js');
    window.healthTraffic = [];
    const original = window.fetch.bind(window),
      stoppedOrigins = new Set();
    window.fetch = async (url, options) => {
      const origin = new URL(url).origin;
      if (stoppedOrigins.has(origin)) {
        throw new Error('Further requests deferred for this origin');
      }
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.floor(Math.random() * 2001)));
      options?.signal?.throwIfAborted();
      const record = { url: String(url), status: null };
      window.healthTraffic.push(record);
      try {
        const response = await original(url, options);
        record.status = response.status;
        record.retryAfterUntil = retryAfterUntil(response.headers.get('retry-after'));
        if (response.status === 429 && !record.retryAfterUntil) {
          record.retryAfterUntil = Date.now() + 86400000;
        }
        if ([401, 403, 405, 429].includes(response.status) || record.retryAfterUntil) {
          stoppedOrigins.add(origin);
        }
        return response;
      } catch (error) {
        record.error = error.name;
        throw error;
      }
    };
  });
  for (const id of plannedStores) {
    const cooldownUntil = plan?.failures?.[id]?.cooldownUntil;
    if (cooldownUntil > Date.now()) {
      report.results.push({ store: id, status: 'deferred', cooldownUntil, attempts: [] });
      console.log(id + ': deferred until ' + new Date(cooldownUntil).toISOString());
      continue;
    }
    const jitter = randomInt(0, 121);
    console.log(id + ': start jitter ' + jitter + ' seconds');
    await sleep(jitter * 1000);
    const batch = [id];
    const results = await page.evaluate(async ids => {
      const { STORES } = await import('./stores.js');
      const { compareStore, loadPage } = await import('./compare.js');
      const { detectBook, parseOffer } = await import('./parser.js');
      const { inspectOffer, failureCode, canRetry } = await import('./health-check.js');
      return Promise.all(
        ids.map(async id => {
          const store = STORES.find(s => s.id === id),
            attempts = [];
          for (let attempt = 1; attempt <= 2; attempt++) {
            const start = window.healthTraffic.length;
            let check;
            try {
              const result = await compareStore(
                store,
                store.sample,
                AbortSignal.timeout(60000),
                undefined,
                store.sampleTitle || ''
              );
              check = inspectOffer(store, result);
              if (check === 'ok') {
                const doc = await loadPage(result.url, AbortSignal.timeout(15000));
                const productUrl = doc.shopUrl || result.url;
                if (detectBook(doc, productUrl).isbn !== store.sample) {
                  check = 'page-detection';
                } else {
                  const offer = parseOffer(doc, store.sample, productUrl);
                  check = offer
                    ? inspectOffer(store, { ...offer, url: productUrl, status: 'ok' })
                    : 'pattern-unverified';
                }
              }
            } catch {
              check = 'request-failed';
            }
            const requests = window.healthTraffic.slice(start).filter(r => {
              try {
                return new URL(r.url).origin === store.origin;
              } catch {
                return false;
              }
            });
            const status = failureCode(check, requests);
            attempts.push({ status, requests: requests.slice(0, 24) });
            if (status === 'ok' || !canRetry(status, requests)) {
              break;
            }
            if (attempt === 1) {
              await new Promise(r => setTimeout(r, 20000 + Math.floor(Math.random() * 20001)));
            }
          }
          return {
            store: id,
            name: store.name,
            isbn: store.sample,
            url: store.search(store.sample),
            status: attempts.at(-1).status,
            cooldownUntil: Math.max(
              0,
              ...attempts.flatMap(a => a.requests.map(r => r.retryAfterUntil || 0))
            ),
            attempts
          };
        })
      );
    }, batch);
    report.results.push(...results);
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    for (const result of results) {
      console.log(`${result.store}: ${result.status}`);
    }
  }
  report.complete = report.results.length === plannedStores.length;
} catch (error) {
  report.infrastructureError = `Live checker could not finish (${error.name}). See the workflow log.`;
  console.error(report.infrastructureError);
} finally {
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  await context?.close();
  if (dirname(profile) === resolve(tmpdir()) && basename(profile).startsWith('lmb-monitor-')) {
    await rm(profile, { recursive: true, force: true });
  } else {
    process.exitCode = 1;
    console.error('Unexpected temporary profile path');
  }
}
if (!report.complete || report.results.some(r => !['ok', 'deferred'].includes(r.status))) {
  process.exitCode = 1;
}
