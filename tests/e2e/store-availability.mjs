/**
 * Bertrand and Almedina put no availability in JSON-LD: the popup must read it from the product
 * page and show «Novo · Em stock» for the books reported on 12 Nov 2026, from either store's page.
 * Set BERTRAND_HTML and ALMEDINA_HTML to saved copies of the live pages, and PROOF_DIR, to take
 * the proof screenshots from them.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const isbn = '9789899292345';
const bertrandUrl = 'https://www.bertrand.pt/livro/o-ladrao-de-aboboras-alice-hemming/33799729';
const almedinaUrl = 'https://www.almedina.net/o-ladr-o-de-ab-boras-1790647240.html';
const bertrandHtml = process.env.BERTRAND_HTML
  ? await readFile(process.env.BERTRAND_HTML, 'utf8')
  : `<script type="application/ld+json">{"@type":"Book","name":"O Ladrão de Abóboras","url":"/livro/o-ladrao-de-aboboras-alice-hemming/33799729","offers":{"@type":"Offer","priceCurrency":"EUR","price":"11.12"},"isbn":"${isbn}"}</script><h1>O Ladrão de Abóboras</h1><div class="purchase-box-logistics"><div class="logistic-item"><span class="text-green font-regular availability">Em Stock Online</span></div></div>`;
const almedinaHtml = process.env.ALMEDINA_HTML
  ? await readFile(process.env.ALMEDINA_HTML, 'utf8')
  : `<script type="application/ld+json">{"@type":"Product","additionalType":"https://schema.org/Book","name":"O Ladrão de Abóboras","sku":"${isbn}","isbn":"${isbn}","offers":{"@type":"Offer","url":"${almedinaUrl}","priceCurrency":"EUR","price":"12.51"}}</script><div class="product-info-main"><h1><span class="base">O Ladrão de Abóboras</span></h1><div class="availability"><span id="availability" data-dispon-id="1"> Stock Online Disponível </span></div></div>`;

const root = resolve('dist/chrome');
const server = createServer(async (req, res) => {
  try {
    const file = resolve(root, `.${new URL(req.url, 'http://localhost').pathname}`);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    res.setHeader(
      'Content-Type',
      { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] ||
        'application/octet-stream'
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, tabUrl, html] of [
    ['bertrand', `${bertrandUrl}?a_aid=5d3f094d9af11`, bertrandHtml],
    ['bertrand-sem-aid', bertrandUrl, bertrandHtml],
    ['almedina', almedinaUrl, almedinaHtml]
  ]) {
    const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
    await page.addInitScript(
      ({ tabUrl, html }) => {
        window.__data = { selectedStores: ['bertrand', 'almedina'], autoEnabled: false };
        window.chrome = {
          runtime: { getManifest: () => ({ version: '0.1.9' }) },
          storage: {
            local: {
              get: async () => window.__data,
              set: async data => {
                window.__data = { ...window.__data, ...data };
              },
              remove: async keys => {
                for (const key of keys) {
                  delete window.__data[key];
                }
              }
            }
          },
          permissions: { contains: async () => true },
          alarms: { create: async () => {}, clear: async () => true, get: async () => null },
          tabs: { query: async () => [{ id: 1, url: tabUrl }] },
          scripting: { executeScript: async () => [{ result: { html } }] }
        };
      },
      { tabUrl, html }
    );
    await page.route('https://**/*', route =>
      route.fulfill({ status: 403, body: 'Not configured' })
    );
    await page.route('https://www.bertrand.pt/**', route =>
      route.fulfill({
        contentType: 'text/html',
        body: route.request().url().includes('/pesquisa/')
          ? `<a href="${new URL(bertrandUrl).pathname}">O Ladrão de Abóboras</a>`
          : bertrandHtml
      })
    );
    await page.route('https://www.almedina.net/**', route =>
      route.fulfill({
        contentType: 'text/html',
        body: route.request().url().includes('/catalogsearch/')
          ? `<a class="product-item-link" href="${almedinaUrl}">O Ladrão de Abóboras</a>`
          : almedinaHtml
      })
    );
    await page.goto(`http://127.0.0.1:${server.address().port}/popup.html`);
    await page.waitForFunction(isbn => document.querySelector('#isbn').value === isbn, isbn);
    await page
      .getByRole('status')
      .filter({ hasText: /preços confirmados|2 de 2/ })
      .waitFor();
    for (const store of ['Bertrand', 'Almedina']) {
      const row = page.locator('#results .offer').filter({ hasText: store });
      assert.match(await row.textContent(), /Novo · Em stock/, `${name}: ${store}`);
    }
    if (process.env.PROOF_DIR) {
      await mkdir(process.env.PROOF_DIR, { recursive: true });
      await page.screenshot({ path: `${process.env.PROOF_DIR}/popup-stock-${name}.png` });
    }
    await page.close();
  }
  console.log('PASS store availability: Bertrand and Almedina show «Novo · Em stock»');
} finally {
  await browser.close();
  server.close();
}
