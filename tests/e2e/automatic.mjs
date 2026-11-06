import { chromium } from 'playwright';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
await mkdir('work', { recursive: true });
const root = await mkdtemp(resolve('work/automatic-'));
await cp('dist/chrome', `${root}/extension`, { recursive: true });
const manifest = JSON.parse(await readFile(`${root}/extension/manifest.json`, 'utf8'));
manifest.host_permissions = ['https://www.wook.pt/*', 'https://www.bertrand.pt/*'];
await writeFile(`${root}/extension/manifest.json`, JSON.stringify(manifest));
const context = await chromium.launchPersistentContext(`${root}/profile`, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${root}/extension`, `--load-extension=${root}/extension`]
});
context.on('console', m => {
  if (m.type() === 'error') {
    console.error('Browser:', m.text());
  }
});
context.on('weberror', e => console.error('Page error:', e.error()));
const isbn = '9780306406157';
const html = price =>
  `<html><head><title>Livro de teste</title><script type="application/ld+json">${JSON.stringify({ '@type': 'Book', isbn, name: 'Livro de teste', offers: { price, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } })}</script></head><body><h1>Livro de teste</h1></body></html>`;

// Chromium offscreen targets do not participate in Playwright's page routing.
// Replace only the network boundary in this isolated test copy, preserving the real parsers and messaging.
const networkFixture = `globalThis.fetch = async (url, options) => {
  if(options.credentials !== 'omit') throw new Error('Requests must omit cookies');
  options.signal.throwIfAborted();
  await chrome.runtime.sendMessage({type:'fixture-fetch'});
  const origin = new URL(url).origin;
  const response = new Response(origin === 'https://www.wook.pt' ? ${JSON.stringify(html('20.00'))} : ${JSON.stringify(html('18.00'))}, {status:200,headers:{'Content-Type':'text/html'}});
  Object.defineProperty(response,'url',{value:String(url)});return response;
};\n`;
await writeFile(
  `${root}/extension/offscreen.js`,
  networkFixture + (await readFile('offscreen.js', 'utf8'))
);
try {
  await context.route('https://**/*', route =>
    route.fulfill({ status: 403, body: 'Not configured' })
  );
  await context.route('https://www.wook.pt/**', route => {
    return route.fulfill({
      contentType: 'text/html',
      headers: {
        'Content-Security-Policy': "default-src 'none'; style-src 'none'; script-src 'none'"
      },
      body: html('20.00')
    });
  });
  await context.route('https://www.bertrand.pt/**', route => {
    return route.fulfill({ contentType: 'text/html', body: html('18.00') });
  });
  const settings = await context.newPage();
  await settings.goto('chrome://extensions');
  const id = await settings.evaluate(
    async () =>
      (await chrome.developerPrivate.getExtensionsInfo({})).find(
        e => e.name === 'Livros Mais Baratos PT'
      ).id
  );
  // Fresh installation: visit a book without opening the popup or writing any preferences.
  const shop = await context.newPage();
  await shop.goto('https://www.wook.pt/livro/teste');
  await shop.getByText('Poupa 2,00').waitFor({ timeout: 20000 });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.waitForFunction(
    () => document.querySelector('#auto-toggle').getAttribute('aria-pressed') === 'true'
  );
  assert.equal(await popup.locator('#shop-list input:checked').count(), 6);
  assert.equal(
    await popup.evaluate(async () => (await chrome.storage.local.get('autoEnabled')).autoEnabled),
    undefined,
    'Fresh install needs no activation preference'
  );
  await popup.evaluate(() => {
    window.autoRequests = 0;
    chrome.runtime.onMessage.addListener(m => {
      if (m.type === 'fixture-fetch') {
        window.autoRequests++;
      }
    });
  });
  assert.equal(
    await shop.getByRole('link', { name: 'Ver oferta na Bertrand' }).getAttribute('href'),
    `https://www.bertrand.pt/pesquisa/${isbn}?a_aid=5d3f094d9af11`
  );
  const afterFirst = await popup.evaluate(() => window.autoRequests);
  assert.equal(afterFirst, 0);
  assert.equal(
    await shop.locator('#lmb-price-alert').evaluate(e => getComputedStyle(e).position),
    'fixed'
  );
  assert.equal(
    await shop
      .locator('#lmb-price-alert section')
      .evaluate(e => getComputedStyle(e).backgroundColor),
    'rgb(255, 255, 255)'
  );
  await shop.getByRole('button', { name: 'Fechar aviso' }).click();
  await shop.evaluate(() => document.body.append(document.createElement('p')));
  await shop.waitForTimeout(1800);
  assert.equal(
    await shop.locator('#lmb-price-alert').count(),
    0,
    'Dismissal survives page mutations'
  );
  await shop.reload();
  await shop.getByText('Poupa 2,00').waitFor();
  assert.equal(
    await popup.evaluate(() => window.autoRequests),
    afterFirst,
    'Repeated edition uses cached comparisons'
  );
  assert.equal(
    await popup.evaluate(
      async isbn => (await chrome.storage.local.get('priceCache')).priceCache[isbn].offers.length,
      isbn
    ),
    2,
    'automatic results persist for the menu'
  );
  await shop.evaluate(() => {
    const script = document.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script.textContent);
    data.offers.price = '17.00';
    script.textContent = JSON.stringify(data);
  });
  await shop.locator('#lmb-price-alert').waitFor({ state: 'detached' });
  await shop.reload();
  await shop.getByText('Poupa 2,00').waitFor();
  await shop.evaluate(() => history.pushState({}, '', '/pesquisa?keyword=other'));
  await shop.locator('#lmb-price-alert').waitFor({ state: 'detached' });
  await shop.goto('https://www.wook.pt/livro/teste');
  await shop.getByText('Poupa 2,00').waitFor();
  await popup.evaluate(() => chrome.storage.local.set({ autoEnabled: false }));
  await shop.locator('#lmb-price-alert').waitFor({ state: 'detached' });
  await popup.waitForFunction(
    async () => !(await chrome.scripting.getRegisteredContentScripts()).length
  );
  assert.equal(
    await popup.evaluate(
      async () =>
        (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length
    ),
    0
  );
  await shop.reload();
  await shop.waitForTimeout(1800);
  assert.equal(
    await shop.locator('#lmb-price-alert').count(),
    0,
    'Saved off preference survives navigation'
  );
  await popup.reload();
  await popup.waitForFunction(
    () => document.querySelector('#auto-toggle').getAttribute('aria-pressed') === 'false'
  );
  await popup.evaluate(() => chrome.storage.local.set({ autoEnabled: true }));
  await shop.getByText('Poupa 2,00').waitFor();
  await mkdir('work', { recursive: true });
  await shop.screenshot({ path: 'work/automatic-alert.png' });
  await popup.evaluate(() => chrome.storage.local.set({ selectedStores: ['wook'] }));
  await shop.locator('#lmb-price-alert').waitFor({ state: 'detached' });
  await popup.waitForFunction(
    async () => (await chrome.scripting.getRegisteredContentScripts())[0]?.matches.length === 1
  );
  console.log(
    'Automatic alerts passed: fresh installation without popup or setup, saved off preference, existing tabs, real background/offscreen messaging, cheaper offer, dismissal, cache, price changes, SPA navigation, disable and re-enable.'
  );
} finally {
  await context.close();
}
