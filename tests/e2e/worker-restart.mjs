import { chromium } from 'playwright';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// O Chrome para o service worker ao fim de ~30 s sem atividade e ao reiniciar o navegador.
// Este teste para-o via CDP e confirma que o popup, o change-data e o aviso na página voltam a funcionar.
const INITIAL = 'A procurar o livro nesta página…';
// No fim da comparação o popup mostra a contagem e, depois de gravar a cache, os preços guardados.
const DONE = /^2 de 2 preços confirmados|^Preços guardados: .* · 2 lojas/;
await mkdir('work', { recursive: true });
const root = await mkdtemp(resolve('work/worker-restart-'));
await cp('dist/chrome', `${root}/extension`, { recursive: true });
const manifest = JSON.parse(await readFile(`${root}/extension/manifest.json`, 'utf8'));
manifest.host_permissions = ['https://www.wook.pt/*', 'https://www.bertrand.pt/*'];
await writeFile(`${root}/extension/manifest.json`, JSON.stringify(manifest));
const isbn = '9780306406157';
const html = price =>
  `<html><head><title>Livro de teste</title><script type="application/ld+json">${JSON.stringify({ '@type': 'Book', isbn, name: 'Livro de teste', offers: { price, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } })}</script></head><body><h1>Livro de teste</h1></body></html>`;
// O popup e o documento offscreen não passam pelo routing do Playwright; substitui só a
// fronteira de rede nesta cópia de teste, mantendo os parsers e as mensagens reais.
await writeFile(
  `${root}/extension/compare.js`,
  `globalThis.fetch = async (url, options) => {
  options?.signal?.throwIfAborted();
  const wook = new URL(url).origin === 'https://www.wook.pt';
  const response = new Response(wook ? ${JSON.stringify(html('20.00'))} : ${JSON.stringify(html('18.00'))}, {status:200,headers:{'Content-Type':'text/html'}});
  Object.defineProperty(response,'url',{value:String(url)});return response;
};\n` + (await readFile('compare.js', 'utf8'))
);
// Página vazia só para este perfil de teste, para chamar APIs da extensão sem correr o popup.
await writeFile(`${root}/extension/blank.html`, '<!doctype html><title>teste</title>');
const profile = `${root}/profile`;
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${root}/extension`,
    `--load-extension=${root}/extension`,
    '--remote-debugging-port=0'
  ]
});
const within = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms))
  ]);
// O popup aberto por chrome.action.openPopup() não aparece como página no Playwright.
async function popupTarget(exclude) {
  const port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0];
  for (let attempt = 0; attempt < 50; attempt++) {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = list.find(t => t.url.endsWith('/popup.html') && t.id !== exclude);
    if (target) {
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((ok, fail) => {
        ws.onopen = ok;
        ws.onerror = fail;
      });
      let next = 0;
      const pending = new Map();
      ws.onmessage = event => {
        const message = JSON.parse(event.data);
        pending.get(message.id)?.(message);
      };
      const evaluate = expression =>
        new Promise(ok => {
          const id = ++next;
          pending.set(id, message => ok(message.result?.result?.value));
          ws.send(
            JSON.stringify({
              id,
              method: 'Runtime.evaluate',
              params: { expression, awaitPromise: true, returnByValue: true }
            })
          );
        });
      return { evaluate, close: () => ws.close() };
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Popup did not open');
}
let failed;
try {
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
  // Avisos na página desligados primeiro, para o popup fazer a sua própria comparação.
  // Espera pelo registo inicial para não correr contra a sincronização do arranque.
  await sw.evaluate(async () => {
    let deadline = Date.now() + 10000;
    while (!(await chrome.scripting.getRegisteredContentScripts({ ids: ['book-alerts'] })).length) {
      if (Date.now() > deadline) {
        throw new Error('book-alerts was not registered');
      }
      await new Promise(r => setTimeout(r, 100));
    }
    await chrome.storage.local.set({ selectedStores: ['wook', 'bertrand'], autoEnabled: false });
    deadline = Date.now() + 10000;
    while ((await chrome.scripting.getRegisteredContentScripts()).length) {
      if (Date.now() > deadline) {
        throw new Error('book-alerts stayed registered');
      }
      await new Promise(r => setTimeout(r, 100));
    }
  });
  await context.route('https://**/*', route =>
    route.fulfill({ status: 403, body: 'Not configured' })
  );
  await context.route('https://www.wook.pt/**', route =>
    route.fulfill({ contentType: 'text/html', body: html('20.00') })
  );
  const opener = await context.newPage();
  await opener.goto(`chrome-extension://${id}/blank.html`);
  const cdp = await context.newCDPSession(opener);
  const { targetInfo } = await cdp.send('Target.getTargetInfo');
  await cdp.send('ServiceWorker.enable');
  await cdp.send('ServiceWorker.stopAllWorkers');
  await opener.waitForTimeout(1500);

  const shop = await context.newPage();
  await shop.goto('https://www.wook.pt/livro/teste');
  await shop.bringToFront();
  assert.deepEqual(
    await opener.evaluate(
      async () => (await chrome.storage.local.get('priceCache')).priceCache || {}
    ),
    {},
    'Prices must come from the popup comparison, not from an earlier cache'
  );
  await opener.evaluate(() => chrome.action.openPopup());
  const popup = await popupTarget(targetInfo.targetId);
  let state;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    state = await popup.evaluate(
      `({ status: document.querySelector('#status').textContent, title: document.querySelector('#title').textContent, prices: [...document.querySelectorAll('#results .offer strong')].map(e => e.textContent) })`
    );
    if (DONE.test(state.status)) {
      break;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  assert.notEqual(state.status, INITIAL, 'Popup stuck on the initial text after a worker stop');
  assert.equal(state.title, 'Livro de teste', 'Popup must detect the book on the page');
  assert.match(state.status, DONE);
  assert.equal(state.prices.length, 2, 'Popup must compare prices after a worker stop');

  await cdp.send('ServiceWorker.stopAllWorkers');
  await opener.waitForTimeout(1500);
  // O background só aceita change-data vindo do popup.
  const changed = await popup.evaluate(
    `Promise.race([chrome.runtime.sendMessage({ target: 'background', type: 'change-data', action: { type: 'migrate' } }).then(r => ({ ok: r?.ok })), new Promise(r => setTimeout(() => r('timeout'), 5000))])`
  );
  popup.close();
  assert.equal(changed?.ok, true, `change-data after worker stop: ${JSON.stringify(changed)}`);

  await opener.evaluate(async () => {
    await chrome.storage.local.set({ autoEnabled: true });
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: ['book-alerts'] });
      if (scripts[0]?.matches?.includes('https://www.wook.pt/*')) {
        return;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('book-alerts was not registered');
  });
  await cdp.send('ServiceWorker.stopAllWorkers');
  await opener.waitForTimeout(1500);
  await shop.reload();
  await shop.getByText('Poupa 2,00').waitFor({ timeout: 20000 });
  console.log(
    'Worker restart passed: popup detects the book and compares prices, change-data answers ok and the page alert returns after the service worker stops.'
  );
} catch (error) {
  failed = error;
} finally {
  await within(context.close(), 10000, 'close').catch(() => {});
}
if (failed) {
  console.error(failed);
  process.exit(1);
}
process.exit(0);
