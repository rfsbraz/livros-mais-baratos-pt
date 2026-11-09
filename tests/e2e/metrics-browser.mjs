import { chromium, firefox } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const kind = process.argv[2] || 'chrome';
const root = resolve('dist/' + kind);
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
const browser = await (kind === 'firefox' ? firefox : chromium).launch({
  headless: true,
  ...(kind === 'edge' ? { channel: process.env.EDGE_CHANNEL || 'msedge' } : {})
});
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
    ({ html, kind }) => {
      const timeout = AbortSignal.timeout.bind(AbortSignal);
      AbortSignal.timeout = ms => timeout(ms === 35000 || ms === 12000 ? 150 : ms);
      // Firefox opt-in: hold the book tab until consent is granted, then reload so
      // detection auto-starts with metrics able to record compare_run (trigger page).
      const fxReady = kind !== 'firefox' || sessionStorage.getItem('fxMetricsReady') === '1';
      window.__collectionGranted = kind !== 'firefox' || fxReady;
      window.__allowConsent = fxReady;
      window.__data = {
        selectedStores: ['wook', 'bertrand', 'almedina', 'bookcover', 'continente'],
        metricsEnabled: kind !== 'firefox' || fxReady,
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
          contains: async () => window.__permission,
          getAll: async () => ({
            data_collection: window.__collectionGranted ? ['technicalAndInteraction'] : []
          }),
          request: async () => {
            window.__collectionGranted = window.__allowConsent;
            return window.__collectionGranted;
          }
        },
        alarms: {
          create: async () => {},
          clear: async () => true,
          get: async () => null
        },
        tabs: {
          query: async () => (fxReady ? [{ id: 1, url: 'https://www.wook.pt/livro/example' }] : [])
        },
        scripting: { executeScript: async () => [{ result: { html } }] }
      };
    },
    { html: product('20.00'), kind }
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
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body>Sem preço disponível.</body></html>'
    })
  );
  await page.route('https://www.almedina.net/**', route =>
    route.fulfill({ status: 403, body: 'Blocked' })
  );
  await page.route('https://bookcover.pt/**', route => route.abort('failed'));
  await page.route('https://www.continente.pt/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.fulfill({ contentType: 'text/html', body: product('17.00') }).catch(() => {});
  });
  await page.route('https://metrics-livros.steamhardwarestock.com/**', async route => {
    metricsPosts.push({
      url: route.request().url(),
      method: route.request().method(),
      body: route.request().postData()
    });
    await route.fulfill({ status: 204 });
  });

  await page.goto(`http://127.0.0.1:${server.address().port}/popup.html`);
  if (kind === 'firefox') {
    // No book tab yet: prove opt-in refusal before auto-start can emit metrics.
    await page
      .getByRole('status')
      .filter({ hasText: 'Introduz um ISBN ou abre uma página de livro' })
      .waitFor();
    const refused = await page.evaluate(async () => {
      const { setMetricsEnabled, recordPoints, flushMetrics } = await import('./metrics.js');
      await recordPoints([{ metric: 'popup_open', count: 1 }]);
      const sent = await flushMetrics({ force: true });
      return {
        enabled: await setMetricsEnabled(true),
        sent: sent.sent,
        pending: window.__data.metricsPending
      };
    });
    assert.deepEqual(refused, { enabled: false, sent: false, pending: undefined });
    assert.equal(metricsPosts.length, 0);
    await page.evaluate(() => {
      sessionStorage.setItem('fxMetricsReady', '1');
    });
    await page.reload();
  }
  await page.waitForFunction(value => document.querySelector('#isbn').value === value, isbn);

  // #79: detection starts the compare; metrics trigger must be page, without Comparar.
  await page
    .getByRole('status')
    .filter({ hasText: 'preços confirmados' })
    .waitFor({ timeout: 60000 });
  assert.equal(
    await page.getByRole('status').filter({ hasText: 'Clica em Comparar para consultar' }).count(),
    0
  );

  const pending = await page.evaluate(() => window.__data.metricsPending);
  assert.ok(pending?.points);
  const points = Object.values(pending.points);
  const byMetric = name => points.filter(p => p.metric === name);
  assert.ok(
    byMetric('compare_run').some(p => p.surface === 'popup' && p.outcome === 'page'),
    'detection must emit compare_run with trigger page'
  );
  assert.equal(
    byMetric('compare_run').filter(p => p.outcome === 'page').length,
    1,
    'detection must not start the compare twice'
  );

  assert.ok(byMetric('store_latency').some(p => p.store === 'wook' && p.outcome === 'price'));
  assert.ok(
    byMetric('store_latency').some(p => p.store === 'bertrand' && p.outcome === 'no_price')
  );
  assert.ok(byMetric('store_latency').some(p => p.store === 'bookcover' && p.outcome === 'error'));
  assert.ok(
    byMetric('store_latency').some(p => p.store === 'continente' && p.outcome === 'timeout')
  );
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
  const clickOffer = async () => {
    const offer = page.locator('#results a').filter({ hasText: 'Wook' }).first();
    await offer.evaluate(link => link.addEventListener('click', event => event.preventDefault()));
    await offer.click();
  };
  assert.equal(
    Object.values((await page.evaluate(() => window.__data.metricsPending))?.points || {}).some(
      point => point.metric === 'affiliate_click'
    ),
    false,
    'Enabling attribution does not fabricate a click'
  );
  await clickOffer();
  await page.waitForFunction(() =>
    Object.values(window.__data.metricsPending?.points || {}).some(
      p => p.metric === 'affiliate_click'
    )
  );
  let points2 = Object.values((await page.evaluate(() => window.__data.metricsPending)).points);
  assert.ok(points2.some(p => p.metric === 'affiliate_click' && p.surface === 'popup_offer'));

  await page.locator('#open-settings').click();
  await page.locator('#affiliate-toggle').uncheck();
  await page.locator('#close-settings').click();
  await clickOffer();
  await page.waitForFunction(() =>
    Object.values(window.__data.metricsPending?.points || {}).some(
      p => p.metric === 'wook_click_no_affiliate'
    )
  );
  points2 = Object.values((await page.evaluate(() => window.__data.metricsPending)).points);
  assert.ok(points2.some(p => p.metric === 'wook_click_no_affiliate'));

  await page.evaluate(async () => {
    const { flushMetrics } = await import('./metrics.js');
    return flushMetrics({ force: true, now: Date.now() + 25 * 60 * 60 * 1000 });
  });
  assert.ok(metricsPosts.length >= 1);
  const body = JSON.parse(metricsPosts.at(-1).body);
  assert.equal(body.browser, kind);
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

  // Compare the actual first rendered offer with collection on and off, alternating
  // runs so browser warm-up and local fixture latency affect both groups equally.
  const timings = { on: [], off: [] };
  for (let run = 0; run < 24; run++) {
    const enabled = run % 2 === 0;
    await page.getByRole('button', { name: 'Comparar', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('#compare').disabled);
    const elapsed = await page.evaluate(async enabled => {
      const { setMetricsEnabled } = await import('./metrics.js');
      await setMetricsEnabled(enabled);
      return new Promise(resolve => {
        const started = performance.now();
        const observer = new MutationObserver(() => {
          if (document.querySelector('#results .offer strong')) {
            observer.disconnect();
            resolve(performance.now() - started);
          }
        });
        observer.observe(document.querySelector('#results'), { childList: true, subtree: true });
        document.querySelector('#compare').click();
      });
    }, enabled);
    if (run >= 4) {
      timings[enabled ? 'on' : 'off'].push(elapsed);
    }
  }
  const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const impact = median(timings.on) - median(timings.off);
  assert.ok(impact <= 5, `first rendered result impact ${impact}ms (${kind})`);
  console.log(`First-result median impact (${kind}): ${impact.toFixed(3)}ms`);

  // Firefox-style opt-in: disabled by default means no pending growth after clear.
  await page.evaluate(async () => {
    const { setMetricsEnabled, recordPoints } = await import('./metrics.js');
    await setMetricsEnabled(false);
    await recordPoints([{ metric: 'popup_open', count: 1 }]);
  });
  assert.equal(await page.evaluate(() => window.__data.metricsPending), undefined);

  assert.deepEqual(errors, []);
  console.log(`Metrics browser suite passed (${kind}).`);
} finally {
  await browser.close();
  server.close();
}
