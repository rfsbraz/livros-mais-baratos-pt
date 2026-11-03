import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('extension');
const server = createServer(async (req, res) => {
  try {
    const file = resolve(root, `.${new URL(req.url, 'http://localhost').pathname}`);
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const content = await readFile(file);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const isbn = '9780306406157';
function product(price, currency = 'EUR', stock = 'InStock', id = isbn) {
  return `<html><head><title>Livro de teste</title><script type="application/ld+json">${JSON.stringify({ '@type': 'Book', isbn: id, name: 'Uma pequena biblioteca', offers: { price, priceCurrency: currency, availability: `https://schema.org/${stock}` } })}</script></head><body><h1>Uma pequena biblioteca</h1></body></html>`;
}
try {
  await page.addInitScript(({ html }) => {
    window.__data = JSON.parse(localStorage.getItem('testData') || '{"selectedStores":["wook","bertrand","almedina","bookcover"]}');
    window.__permission = true;
    window.chrome = {
      storage: { local: { get: async () => window.__data, set: async data => { window.__data = { ...window.__data, ...data }; localStorage.setItem('testData', JSON.stringify(window.__data)); } } },
      permissions: { contains: async request => { window.__requested = request; return window.__permission; } },
      tabs: { query: async () => [{ id: 1, url: 'https://www.wook.pt/livro/example' }] },
      scripting: { executeScript: async () => [{ result: { html } }] }
    };
  }, { html: product('20.00') });
  await page.route('https://**/*', route => route.fulfill({ status: 403, body: 'Unconfigured test store' }));
  await page.route('https://www.wook.pt/**', route => route.fulfill({ contentType: 'text/html', body: product('18.00') }));
  await page.route('https://www.bertrand.pt/**', route => route.fulfill({ contentType: 'text/html', body: product('17.00') }));
  await page.route('https://www.almedina.net/**', route => route.fulfill({ status: 403, body: 'Blocked' }));
  await page.route('https://bookcover.pt/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ sku: isbn, type: 'simple', name: 'Uma pequena biblioteca', prices: { price: '1200', currency_code: 'EUR', currency_minor_unit: 2 }, permalink: 'https://bookcover.pt/product/test/', is_in_stock: false }]) }));
  await page.goto(`http://127.0.0.1:${server.address().port}/popup.html`);
  await page.waitForFunction(() => document.querySelector('#isbn').value === '9780306406157');
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '3 de 4' }).waitFor();
  assert.equal(await page.locator('.best a').textContent(), 'Bertrand');
  assert.equal(await page.locator('.offer').count(), 4);
  assert.match(await page.locator('#results').textContent(), /Sem stock/);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Livro guardado' }).waitFor();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#count').textContent === '1');
  assert.equal(await page.evaluate(() => window.__data.history['9780306406157'].length), 3);
  // Parser regressions: wrong edition, script injection, currency and search/product separation.
  const parsed = await page.evaluate(async ({ good, wrong }) => {
    const { parseOffer, detectBook, productLinks } = await import('./parser.js');
    const { STORES } = await import('./core.js');
    const parse = s => new DOMParser().parseFromString(s, 'text/html');
    return {
      good: parseOffer(parse(good), '9780306406157', 'https://www.wook.pt/livro/example')?.price,
      wook: parseOffer(parse('<script type="application/ld+json">{"@type":"Book","isbn":"9789895701124","name":"A Criada","offers":{"price":"19.46"}}</script><div id="product-price"><span class="price">19,46€</span></div><div class="price">1,00€</div>'), '9789895701124', 'https://www.wook.pt/livro/a-criada-freida-mcfadden/28535345')?.price,
      wrong: parseOffer(parse(wrong), '9780306406157', 'https://www.wook.pt/livro/example'),
      malformed: detectBook(parse('<script type="application/ld+json">broken</script>')).isbn,
      links: productLinks(parse('<a href="https://evil.test/livro/steal">bad</a><a href="/livro/good">good</a>'), STORES[0], STORES[0].origin)
    };
  }, { good: product('18.00'), wrong: product('1.00', 'EUR', 'InStock', '9780804429573') });
  assert.equal(parsed.good, 1800); assert.equal(parsed.wook, 1946); assert.equal(parsed.wrong, null); assert.equal(parsed.malformed, null); assert.deepEqual(parsed.links, ['https://www.wook.pt/livro/good']);
  const fixtures = JSON.parse(await readFile('tests/fixtures/store-shapes.json', 'utf8')).cases;
  const fixtureResults = await page.evaluate(async cases => {
    const { parseOffer, detectBook } = await import('./parser.js');
    return cases.map(c => {
      const doc = new DOMParser().parseFromString(c.html, 'text/html');
      return { store: c.store, offer: parseOffer(doc, c.isbn, c.url), detected: detectBook(doc, c.url).isbn, wrong: parseOffer(doc, '9780306406157', c.url) };
    });
  }, fixtures);
  for (let i = 0; i < fixtures.length; i++) {
    const expected = fixtures[i], actual = fixtureResults[i];
    assert.equal(actual.offer?.price, expected.price, `${expected.store}: observed price shape`);
    assert.equal(actual.offer?.currency, expected.currency, `${expected.store}: currency`);
    assert.equal(actual.detected, expected.isbn, `${expected.store}: detected ISBN`);
    assert.equal(actual.wrong, null, `${expected.store}: wrong edition must be rejected`);
  }
  assert.equal(await page.locator('.shop-option').count(), 26);
  assert.equal(await page.locator('#manual-results .manual-row').count(), 17);
  const fallback = await page.evaluate(async ({ good, wrong }) => {
    const { compareStore } = await import('./compare.js');
    const { STORES } = await import('./stores.js');
    const store = STORES.find(s => s.id === 'gradiva'), fetched = [];
    const result = await compareStore(store, '9780306406157', new AbortController().signal, async url => {
      fetched.push(url);
      let html = '';
      if (url.includes('s=978')) html = '<a href="/produto/wrong/">Other edition</a><a href="/produto/cart/?add-to-cart=1">Add</a>';
      else if (url.includes('s=')) html = '<a href="/produto/right/">Exact edition</a>';
      else html = url.includes('/right/') ? good : wrong;
      return new DOMParser().parseFromString(html, 'text/html');
    }, 'The title');
    return { status: result.status, price: result.price, fetched };
  }, { good: product('18.00'), wrong: product('1.00', 'EUR', 'InStock', '9780804429573') });
  assert.equal(fallback.status, 'ok'); assert.equal(fallback.price, 1800);
  assert.equal(fallback.fetched.length, 4);
  assert(!fallback.fetched.some(url => url.includes('add-to-cart')));
  await page.locator('#isbn').fill('9780306406158');
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'válido' }).waitFor();
  await page.locator('#isbn').fill(isbn);
  await page.evaluate(() => { window.__permission = false; });
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Acesso não autorizado' }).waitFor();
  assert.equal(await page.locator('#auto-toggle').getAttribute('aria-pressed'), 'true');
  await page.locator('#auto-toggle').click();
  await page.getByRole('status').filter({ hasText: 'Avisos automáticos desativados' }).waitFor();
  await page.locator('#auto-toggle').click();
  await page.getByRole('status').filter({ hasText: 'avisos continuam desativados' }).waitFor();
  await page.evaluate(() => { window.__permission = true; });
  await page.locator('#auto-toggle').click();
  await page.getByRole('status').filter({ hasText: 'Avisos ativos' }).waitFor();
  assert.equal(await page.evaluate(() => window.__data.autoEnabled), true);
  await page.locator('#auto-toggle').click();
  await page.getByRole('status').filter({ hasText: 'Avisos automáticos desativados' }).waitFor();
  assert.equal(await page.evaluate(() => window.__data.autoEnabled), false);
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '3 de 4' }).waitFor();
  await mkdir('work', { recursive: true });
  await page.screenshot({ path: 'work/extension-preview.png', fullPage: true });
  // Selection survives reload, requests only selected origins, and cancellation does not save partial history.
  await page.locator('#shops > summary').click();
  await page.locator('#select-none').click();
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'pelo menos uma loja' }).waitFor();
  await page.locator('input[value="wook"]').check();
  await page.waitForFunction(() => window.__data.selectedStores.join() === 'wook');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#coverage').textContent === 'Lojas: 1 de 26 selecionadas');
  const beforeCancel = await page.evaluate(() => JSON.stringify(window.__data.history));
  let releaseRequest;
  const requestStarted = new Promise(resolve => { releaseRequest = resolve; });
  await page.route('https://www.wook.pt/**', route => { releaseRequest(route); });
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  const pending = await requestStarted;
  await page.getByRole('button', { name: 'Parar consulta', exact: true }).click();
  await pending.fulfill({ contentType: 'text/html', body: product('18.00') }).catch(() => {});
  await page.getByRole('status').filter({ hasText: 'Consulta interrompida' }).waitFor();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__data.history)), beforeCancel);
  assert.deepEqual(await page.evaluate(() => window.__requested.origins), ['https://www.wook.pt/*']);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Apagar dados' }).click();
  await page.getByRole('status').filter({ hasText: 'apagados' }).waitFor();
  assert.equal(await page.evaluate(() => Object.keys(window.__data.history).length), 0);
  assert.equal(await page.locator('#count').textContent(), '0');
  assert.deepEqual(errors, []);
  console.log('Browser integration passed: detection, exact ISBN, currency parsing, stock ranking, blocked shop, save/reload, invalid input, permission denial and data deletion. Fixtures are synthetic, not live prices.');
} finally { await browser.close(); server.close(); }
