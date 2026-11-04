import { chromium } from 'playwright';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
await mkdir('work', { recursive: true });
const root = await mkdtemp(resolve('work/voucher-'));
await cp('dist/chrome', `${root}/extension`, { recursive: true });
const manifest = JSON.parse(await readFile(`${root}/extension/manifest.json`, 'utf8'));
manifest.host_permissions = ['https://www.wook.pt/*'];
await writeFile(`${root}/extension/manifest.json`, JSON.stringify(manifest));
const isbn = '9780306406157',
  url = 'https://www.wook.pt/livro/exemplo/123';
const termsUrl = 'https://www.wook.pt/Mensagem/index/?key=leitura-em-festa';
const date = new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'Europe/Lisbon',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
}).format(new Date());
const terms = `Encomendas registadas e pagas no dia ${date}, Portugal Continental. O valor pago será devolvido sob a forma de vale de compras (VALE 100%), 15 dias após o envio da totalidade da encomenda. O vale não é reembolsável em dinheiro. Validade do vale: 60 dias. Até ao limite de 50% do valor total da encomenda.`;
const html = `<html><head><script type="application/ld+json">${JSON.stringify({ '@type': 'Book', isbn, name: 'Exemplo', offers: { price: '18.85', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } })}</script></head><body><h1>Exemplo</h1><div class="sale-container"><div class="wook-container"><a href="${termsUrl}">Leitura em festa</a></div></div></body></html>`;
const fixture = `globalThis.fetch=async (raw,options)=>{if(options.credentials!=='omit')throw new Error('Cookies'); const terms=String(raw).includes('/Mensagem/');const response=new Response(terms?${JSON.stringify(terms)}:${JSON.stringify(html)},{status:200});Object.defineProperty(response,'url',{value:terms?String(raw):${JSON.stringify(url)}});return response;};\n`;
await writeFile(
  `${root}/extension/offscreen.js`,
  fixture + (await readFile('offscreen.js', 'utf8'))
);
const context = await chromium.launchPersistentContext(`${root}/profile`, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${root}/extension`, `--load-extension=${root}/extension`]
});
try {
  await context.route('https://www.wook.pt/**', route =>
    route.fulfill({ contentType: 'text/html', body: html })
  );
  const shop = await context.newPage();
  await shop.goto(url);
  await shop.locator('#lmb-price-alert .voucher-promotion').waitFor({ timeout: 20000 });
  assert(
    (await shop.locator('#lmb-price-alert .voucher-promotion').textContent()).includes('33,3%')
  );
  assert.equal(await shop.getByRole('link', { name: 'Saber mais' }).getAttribute('href'), termsUrl);
  assert.equal(await shop.getByRole('link', { name: /Ver oferta/ }).count(), 0);
  await shop.getByRole('link', { name: 'Saber mais' }).evaluate(a =>
    a.addEventListener('click', e => {
      e.preventDefault();
      window.__clicked = a.href;
    })
  );
  await shop.getByRole('link', { name: 'Saber mais' }).click();
  assert((await shop.evaluate(() => window.__clicked)).includes('a_aid=5d3ee4327c2fd'));
  const settings = await context.newPage();
  await settings.goto('chrome://extensions');
  const id = await settings.evaluate(
    async () =>
      (await chrome.developerPrivate.getExtensionsInfo({})).find(
        e => e.name === 'Livros Mais Baratos PT'
      ).id
  );
  await settings.goto(`chrome-extension://${id}/popup.html`);
  const offers = await settings.evaluate(
    async isbn => (await chrome.storage.local.get('priceCache')).priceCache[isbn].offers,
    isbn
  );
  assert.equal(offers[0].price, 1885);
  assert.equal(offers[0].promotion.refundPercent, 100);
  await settings.evaluate(() => chrome.storage.local.set({ affiliateEnabled: false }));
  await shop.reload();
  await shop.locator('#lmb-price-alert .voucher-promotion').waitFor();
  await shop.getByRole('link', { name: 'Saber mais' }).evaluate(a =>
    a.addEventListener('click', e => {
      e.preventDefault();
      window.__clicked = a.href;
    })
  );
  await shop.getByRole('link', { name: 'Saber mais' }).click();
  assert.equal(await shop.evaluate(() => window.__clicked), termsUrl);
  await shop.screenshot({ path: 'work/wook-voucher-alert.png' });
  console.log(
    'Campanha detetada automaticamente, preço preservado, cache e preferência de afiliados verificados.'
  );
} finally {
  await context.close();
}
