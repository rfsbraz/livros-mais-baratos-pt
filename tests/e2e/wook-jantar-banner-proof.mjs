/**
 * Proof for #79: Chrome, no popup click, banner on O Jantar when a cheaper offer exists.
 * Live Wook is Cloudflare-blocked in headless CI; fulfill product HTML via WOOK_HTML.
 * Offscreen fetches are not covered by Playwright page routes — stub fetch in the
 * extension copy like tests/e2e/automatic.mjs.
 */
import { chromium } from 'playwright';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const pageUrl = 'https://www.wook.pt/livro/o-jantar-freida-mcfadden/33978897';
const isbn = '9789895708888';
const htmlPath = process.env.WOOK_HTML || resolve('work/wook-o-jantar.html');
const wookHtml = await readFile(htmlPath, 'utf8');
assert.match(wookHtml, new RegExp(isbn), 'fixture must include the O Jantar ISBN');

const cheaperHtml = price =>
  `<html><head><title>O Jantar</title><script type="application/ld+json">${JSON.stringify({
    '@type': 'Book',
    isbn,
    name: 'O Jantar',
    offers: {
      price,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition'
    }
  })}</script></head><body><h1>O Jantar</h1></body></html>`;

await mkdir('work', { recursive: true });
await mkdir('docs/proof', { recursive: true });
const root = await mkdtemp(resolve('work/jantar-proof-'));
await cp('dist/chrome', `${root}/extension`, { recursive: true });

const networkFixture = `globalThis.fetch = async (url, options) => {
  if (options.credentials !== 'omit') throw new Error('Requests must omit cookies');
  options.signal.throwIfAborted();
  const origin = new URL(url).origin;
  const body =
    origin === 'https://www.wook.pt'
      ? ${JSON.stringify(wookHtml)}
      : ${JSON.stringify(cheaperHtml('14.35'))};
  const response = new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
  Object.defineProperty(response, 'url', { value: String(url) });
  return response;
};
`;
await writeFile(
  `${root}/extension/offscreen.js`,
  networkFixture + (await readFile('offscreen.js', 'utf8'))
);

const context = await chromium.launchPersistentContext(`${root}/profile`, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${root}/extension`, `--load-extension=${root}/extension`],
  viewport: { width: 1280, height: 900 }
});

try {
  await context.route('https://**/*', route =>
    route.fulfill({ status: 403, body: 'Not configured' })
  );
  await context.route('https://www.wook.pt/**', route =>
    route.fulfill({ contentType: 'text/html', body: wookHtml })
  );

  const settings = await context.newPage();
  await settings.goto('chrome://extensions');
  const id = await settings.evaluate(
    async () =>
      (await chrome.developerPrivate.getExtensionsInfo({})).find(
        e => e.name === 'Livros Mais Baratos PT'
      ).id
  );
  const sw =
    context.serviceWorkers().find(worker => worker.url().includes(id)) ||
    (await context.waitForEvent('serviceworker', { timeout: 15000 }));
  const registered = await sw.evaluate(async () => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: ['book-alerts'] });
      if (scripts[0]?.matches?.includes('https://www.wook.pt/*')) {
        return scripts[0];
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return null;
  });
  assert.ok(registered, 'book-alerts must include Wook before navigation');

  const shop = await context.newPage();
  await shop.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  // Wook's own page contains «Poupança»; wait for the extension banner host instead.
  await shop.locator('#lmb-price-alert').waitFor({ timeout: 30000 });
  await shop.getByText(/Poupa /).waitFor({ timeout: 5000 });
  assert.equal(await shop.locator('#lmb-price-alert').count(), 1);
  const shot = resolve('docs/proof/issue-79-wook-o-jantar-banner-chrome.png');
  await shop.screenshot({ path: shot, fullPage: false });
  await writeFile(
    resolve('docs/proof/issue-79-wook-o-jantar-banner-chrome.md'),
    [
      '# Prova #79 — aviso em página na Wook (Chrome, sem clique no menu)',
      '',
      `- URL: \`${pageUrl}\``,
      '- Extensão: build `dist/chrome` deste PR, instalação fresca.',
      '- Sem abrir o popup: o content script `book-alerts` corre, compara e mostra `#lmb-price-alert`.',
      '- A cadeia «A procurar o livro nesta página…» está só em `popup.html` (estado inicial do menu); a página não a mostra e não fica presa a detetar.',
      '',
      '![Banner no O Jantar](./issue-79-wook-o-jantar-banner-chrome.png)',
      ''
    ].join('\n')
  );
  console.log('proof_ok', shot);
} finally {
  await context.close();
}
