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
    window.__data = JSON.parse(localStorage.getItem('testData') || '{}');
    window.__permission = true;
    window.chrome = {
      storage: { local: { get: async () => window.__data, set: async data => { window.__data = data; localStorage.setItem('testData', JSON.stringify(data)); } } },
      permissions: { request: async () => window.__permission },
      tabs: { query: async () => [{ id: 1, url: 'https://www.wook.pt/livro/example' }] },
      scripting: { executeScript: async () => [{ result: { html } }] }
    };
  }, { html: product('20.00') });
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
  await page.locator('#isbn').fill('9780306406158');
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'válido' }).waitFor();
  await page.locator('#isbn').fill(isbn);
  await page.evaluate(() => { window.__permission = false; });
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Acesso não autorizado' }).waitFor();
  await page.evaluate(() => { window.__permission = true; });
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '3 de 4' }).waitFor();
  await mkdir('work', { recursive: true });
  await page.screenshot({ path: 'work/extension-preview.png', fullPage: true });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Apagar dados' }).click();
  await page.getByRole('status').filter({ hasText: 'apagados' }).waitFor();
  assert.equal(await page.evaluate(() => Object.keys(window.__data.history).length), 0);
  assert.equal(await page.locator('#count').textContent(), '0');
  assert.deepEqual(errors, []);
  console.log('Browser integration passed: detection, exact ISBN, currency parsing, stock ranking, blocked shop, save/reload, invalid input, permission denial and data deletion. Fixtures are synthetic, not live prices.');
} finally { await browser.close(); server.close(); }
