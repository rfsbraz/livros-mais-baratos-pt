import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve('dist/chrome');
const server = createServer(async (req, res) => {
  try {
    const file = resolve(root, `.${new URL(req.url, 'http://localhost').pathname}`);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const content = await readFile(file);
    res.setHeader(
      'Content-Type',
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json'
      }[extname(file)] || 'application/octet-stream'
    );
    res.end(content);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const isbn = '9780306406157';
const product = (price, currency = 'EUR', stock = 'InStock') =>
  `<html><head><title>Livro</title><script type="application/ld+json">${JSON.stringify({
    '@type': 'Book',
    isbn,
    name: 'Uma pequena biblioteca',
    offers: { price, priceCurrency: currency, availability: `https://schema.org/${stock}` }
  })}</script></head><body><h1>Uma pequena biblioteca</h1></body></html>`;

const metricsPosts = [];
try {
  await page.addInitScript(
    ({ html }) => {
      window.__data = {
        selectedStores: ['wook', 'bertrand', 'almedina'],
        metricsEnabled: true,
        affiliateEnabled: true
      };
      window.__permission = true;
      window.chrome = {
        runtime: { getManifest: () => ({ version: '0.1.6' }) },
        storage: {
          local: {
            remove: async keys => {
              for (const key of [].concat(keys)) {
                delete window.__data[key];
              }
            },
            get: async () => window.__data,
            set: async data => {
              window.__data = { ...window.__data, ...data };
            }
          }
        },
        permissions: {
          contains: async () => window.__permission
        },
        alarms: {
          create: async () => {},
          clear: async () => true,
          get: async () => null
        },
        tabs: { query: async () => [{ id: 1, url: 'https://www.wook.pt/livro/example' }] },
        scripting: { executeScript: async () => [{ result: { html } }] }
      };
    },
    { html: product('20.00') }
  );

  await page.route('https://**/*', route => {
    if (route.request().url().includes('metrics-livros.steamhardwarestock.com')) {
      return route.fallback();
    }
    return route.fulfill({ status: 403, body: 'Unconfigured test store' });
  });
  await page.route('https://www.wook.pt/**', route =>
    route.fulfill({ contentType: 'text/html', body: product('18.00') })
  );
  await page.route('https://www.bertrand.pt/**', route =>
    route.fulfill({ contentType: 'text/html', body: product('17.00') })
  );
  await page.route('https://www.almedina.net/**', route =>
    route.fulfill({ status: 403, body: 'Blocked' })
  );
  await page.route('https://metrics-livros.steamhardwarestock.com/**', async route => {
    metricsPosts.push({
      url: route.request().url(),
      method: route.request().method(),
      body: route.request().postData()
    });
    await route.fulfill({ status: 204 });
  });

  await page.goto(`http://127.0.0.1:${server.address().port}/popup.html`);
  await page.waitForFunction(value => document.querySelector('#isbn').value === value, isbn);

  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page
    .getByRole('status')
    .filter({ hasText: 'preços confirmados' })
    .waitFor({ timeout: 60000 });

  const pending = await page.evaluate(() => window.__data.metricsPending);
  assert.ok(pending?.points);
  const points = Object.values(pending.points);
  const byMetric = name => points.filter(p => p.metric === name);

  assert.ok(byMetric('store_latency').some(p => p.store === 'wook' && p.outcome === 'price'));
  assert.ok(byMetric('store_latency').some(p => p.store === 'bertrand' && p.outcome === 'price'));
  assert.ok(
    byMetric('store_latency').some(
      p => p.store === 'almedina' && (p.outcome === 'blocked' || p.outcome === 'error')
    )
  );
  const first = byMetric('t_first_result')[0];
  const all = byMetric('t_all_settled')[0];
  assert.ok(first && all);
  const order = [
    '250',
    '500',
    '1000',
    '1500',
    '2000',
    '3000',
    '5000',
    '8000',
    '12000',
    '20000',
    '35000',
    'inf'
  ];
  assert.ok(
    order.indexOf(first.bucket) <= order.indexOf(all.bucket) || first.bucket === all.bucket
  );
  assert.ok(byMetric('store_untimed').some(p => p.outcome === 'disabled'));

  await page.locator('#open-settings').click();
  await page.locator('#metrics-toggle').uncheck();
  await page.waitForFunction(() => window.__data.metricsEnabled === false);
  assert.equal(await page.evaluate(() => window.__data.metricsPending), undefined);

  const before = metricsPosts.length;
  await page.evaluate(async () => {
    const { flushMetrics } = await import('./metrics.js');
    return flushMetrics({ force: true, now: Date.now() });
  });
  assert.equal(metricsPosts.length, before);

  await page.locator('#metrics-toggle').check();
  await page.locator('#affiliate-toggle').check();
  await page.locator('#close-settings').click();
  await page.evaluate(async () => {
    const { recordPoints } = await import('./metrics.js');
    await recordPoints([{ metric: 'affiliate_click', surface: 'popup_offer', count: 1 }]);
  });
  let points2 = Object.values((await page.evaluate(() => window.__data.metricsPending)).points);
  assert.ok(points2.some(p => p.metric === 'affiliate_click' && p.surface === 'popup_offer'));

  await page.locator('#open-settings').click();
  await page.locator('#affiliate-toggle').uncheck();
  await page.locator('#close-settings').click();
  await page.evaluate(async () => {
    const { recordPoints } = await import('./metrics.js');
    await recordPoints([{ metric: 'wook_click_no_affiliate', surface: 'popup_offer', count: 1 }]);
  });
  points2 = Object.values((await page.evaluate(() => window.__data.metricsPending)).points);
  assert.ok(points2.some(p => p.metric === 'wook_click_no_affiliate'));

  await page.evaluate(async () => {
    const { flushMetrics } = await import('./metrics.js');
    return flushMetrics({ force: true, now: Date.now() + 25 * 60 * 60 * 1000 });
  });
  assert.ok(metricsPosts.length >= 1);
  const body = JSON.parse(metricsPosts.at(-1).body);
  assert.equal(body.browser, 'chrome');
  assert.equal(/97[89]\d{10}/.test(metricsPosts.at(-1).body), false);
  assert.equal(/https?:/i.test(JSON.stringify(body.points)), false);

  const overhead = await page.evaluate(async () => {
    const { latencyBucket, storeResultPoint, mergePoint } = await import('./metrics.js');
    const samples = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      mergePoint({ points: {} }, storeResultPoint('popup', 'wook', 'ok', 12));
      latencyBucket(12);
      samples.push(performance.now() - t0);
    }
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  });
  assert.ok(overhead < 5, `metrics record overhead ${overhead}ms`);

  // Firefox-style opt-in: disabled by default means no pending growth after clear.
  await page.evaluate(async () => {
    const { setMetricsEnabled, recordPoints } = await import('./metrics.js');
    await setMetricsEnabled(false);
    await recordPoints([{ metric: 'popup_open', count: 1 }]);
  });
  assert.equal(await page.evaluate(() => window.__data.metricsPending), undefined);

  assert.deepEqual(errors, []);
  console.log('Metrics browser suite passed.');
} finally {
  await browser.close();
  server.close();
}
