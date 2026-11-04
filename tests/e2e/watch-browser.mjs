import { chromium } from 'playwright';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
await mkdir('work', { recursive: true });
const root = await mkdtemp(resolve('work/watch-'));
await cp('dist/chrome', root + '/extension', { recursive: true });
const manifest = JSON.parse(await readFile(root + '/extension/manifest.json', 'utf8'));
manifest.host_permissions = ['https://www.wook.pt/*', 'https://www.bertrand.pt/*'];
await writeFile(root + '/extension/manifest.json', JSON.stringify(manifest));
const isbn = '9780306406157';
const fixture =
  "globalThis.fetch = async (url, options) => { options.signal.throwIfAborted(); const price = new URL(url).hostname === 'www.wook.pt' ? '20.00' : '18.00'; const html = '<script type=\"application/ld+json\">' + JSON.stringify({'@type':'Book',isbn:'" +
  isbn +
  "',name:'Livro observado',offers:{price,priceCurrency:'EUR',availability:'https://schema.org/InStock'}}) + '</script>'; const response = new Response(html,{status:200}); Object.defineProperty(response,'url',{value:String(url)}); return response; };\n";
await writeFile(
  root + '/extension/offscreen.js',
  fixture + (await readFile('offscreen.js', 'utf8'))
);
const context = await chromium.launchPersistentContext(root + '/profile', {
  channel: 'chromium',
  headless: true,
  args: [
    '--disable-extensions-except=' + root + '/extension',
    '--load-extension=' + root + '/extension'
  ]
});
try {
  const settings = await context.newPage();
  await settings.goto('chrome://extensions');
  const id = await settings.evaluate(
    async () =>
      (await chrome.developerPrivate.getExtensionsInfo({})).find(
        e => e.name === 'Livros Mais Baratos PT'
      ).id
  );
  const page = await context.newPage();
  await page.goto('chrome-extension://' + id + '/popup.html');
  async function poll(fn, arg) {
    const end = Date.now() + 40000;
    while (Date.now() < end) {
      if (await page.evaluate(fn, arg)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timed out waiting for scheduled state');
  }
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(async isbn => {
    const { changeData } = await import('./data.js');
    await changeData({ type: 'save', book: { isbn, title: 'Livro observado' } });
  }, isbn);
  await page.locator('.watch-form').waitFor();
  await page.locator('.watch-form input[inputmode="decimal"]').fill('19');
  await page.getByRole('button', { name: 'Guardar alerta', exact: true }).click();
  await poll(
    async isbn => (await chrome.storage.local.get('saved')).saved[isbn]?.watch?.target === 1900,
    isbn
  );
  // Upgrade an existing total-based target without losing the shelf or target amount.
  await page.evaluate(async isbn => {
    const { saved } = await chrome.storage.local.get('saved');
    saved[isbn].watch.basis = 'delivered';
    saved[isbn].watch.lastNotifiedPrice = 2000;
    await chrome.storage.local.set({
      saved,
      shipping: { region: 'mainland' },
      priceOrder: 'delivered'
    });
  }, isbn);
  await page.reload();
  await poll(async isbn => {
    const data = await chrome.storage.local.get(null);
    return (
      data.saved[isbn]?.watch?.basis === 'item' && !('shipping' in data) && !('priceOrder' in data)
    );
  }, isbn);
  assert.equal(
    await page.evaluate(
      async isbn => (await chrome.storage.local.get('saved')).saved[isbn].watch.target,
      isbn
    ),
    1900
  );
  await poll(async () => !!(await chrome.alarms.get('saved-book-check')));
  async function trigger() {
    await page.evaluate(async isbn => {
      const { saved } = await chrome.storage.local.get('saved');
      saved[isbn].watch.nextCheckAt = 0;
      await chrome.storage.local.set({ saved, watchLastStart: 0, watchJob: null });
      await chrome.alarms.create('saved-book-check', { when: Date.now() + 100 });
    }, isbn);
  }
  await trigger();
  await poll(
    async () => (await chrome.storage.local.get('watchNotices')).watchNotices?.length === 1,
    null
  );
  let state = await page.evaluate(() => chrome.storage.local.get(null));
  assert.equal(state.watchNotices[0].price, 1800);
  assert.equal(state.history[isbn].length, 2);
  assert(state.history[isbn].every(p => p.source === 'scheduled'));
  const firstNotice = state.watchNotices[0].at;
  await trigger();
  await poll(
    async isbn => (await chrome.storage.local.get('history')).history[isbn].length === 4,
    isbn
  );
  state = await page.evaluate(() => chrome.storage.local.get(null));
  assert.equal(state.watchNotices[0].at, firstNotice, 'same target price does not notify twice');
  // Notification destination opens the observed book without fabricating older history.
  await page.goto('chrome-extension://' + id + '/popup.html?isbn=' + isbn);
  await page.locator('#book').waitFor();
  await page.getByRole('status').filter({ hasText: 'Preços guardados:' }).waitFor();
  assert.equal(await page.locator('#results .offer').count(), 2);
  await page.locator('#history-section').evaluate(el => {
    el.open = true;
  });
  await page.locator('#history svg').waitFor();
  assert.equal(await page.locator('#history circle').count(), 2);
  await page.locator('#open-settings').click();
  await page.locator('#watch-toggle').uncheck();
  await poll(async () => !(await chrome.alarms.get('saved-book-check')));
  await page.screenshot({ path: 'work/targets-history.png', fullPage: true });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Apagar dados' }).click();
  await poll(
    async () => Object.keys((await chrome.storage.local.get('saved')).saved || {}).length === 0
  );
  state = await page.evaluate(() => chrome.storage.local.get(null));
  assert.deepEqual(state.priceCache, {});
  assert.deepEqual(state.history, {});
  assert.deepEqual(state.watchNotices, []);
  assert.equal(state.watchJob, null);
  assert.deepEqual(errors, []);
  console.log(
    'Scheduled browser checks passed: target UI, native alarm, offscreen results, local history, deduplication, chart, pause and clear.'
  );
} finally {
  await context.close();
}
