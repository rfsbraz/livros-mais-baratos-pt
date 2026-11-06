import { test, expect, firefox } from '@playwright/test';
import { withExtension } from 'playwright-webextext';
import { cp, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const isbn = '9780306406157';
const uuid = '497d41cb-12cc-4e58-81aa-93ab18677e01';
test('Firefox automatic comparison, persisted prices and scheduled targets', async () => {
  await mkdir('work', { recursive: true });
  const root = await mkdtemp(resolve('work/firefox-'));
  await cp('dist/firefox', root + '/extension', { recursive: true });
  const fixture = `globalThis.fetch = async (url, options) => { options.signal.throwIfAborted(); const price = new URL(url).hostname === 'www.wook.pt' ? '20.00' : '18.00'; const html = '<script type="application/ld+json">' + JSON.stringify({'@type':'Book',isbn:'${isbn}',name:'Livro Firefox',offers:{price,priceCurrency:'EUR',availability:'https://schema.org/InStock'}}) + '</script>'; const r = new Response(html); Object.defineProperty(r,'url',{value:String(url)}); return r; };\n`;
  await writeFile(
    root + '/extension/offscreen.js',
    fixture + (await readFile('offscreen.js', 'utf8'))
  );
  // Test-only bridge: inspect native storage through a content context because Playwright
  // cannot automate privileged Firefox extension pages. Never included in production ZIPs.
  const manifest = JSON.parse(await readFile(root + '/extension/manifest.json', 'utf8'));
  manifest.content_scripts = [{ matches: ['https://www.wook.pt/*'], js: ['fixture-bridge.js'] }];
  await writeFile(root + '/extension/manifest.json', JSON.stringify(manifest));
  await writeFile(
    root + '/extension/fixture-bridge.js',
    `setInterval(async()=>{try {const d=await chrome.runtime.sendMessage({type:'fixture-state'});document.documentElement.setAttribute('data-fixture-state',JSON.stringify(d));}catch{}},200);`
  );
  await writeFile(
    root + '/extension/background.js',
    (await readFile('dist/firefox/background.js', 'utf8')) +
      `
chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.type!=='fixture-state')return;chrome.storage.local.get(null).then(async d=>reply({cache:d.priceCache?.['${isbn}']?.offers.length || 0,notices:d.watchNotices?.length || 0,watch:d.saved?.['${isbn}']?.watch,job:d.watchJob,alarm:await chrome.alarms.get('saved-book-check')}));return true;});
chrome.storage.local.set({selectedStores:['wook','bertrand']});
let fixtureScheduled=false;
chrome.storage.onChanged.addListener(async changes=>{if(!changes.priceCache || fixtureScheduled)return;fixtureScheduled=true;
await writeData({type:'save',book:{isbn:'${isbn}',title:'Livro Firefox'}});
await writeData({type:'watch',isbn:'${isbn}',target:1900,basis:'item',enabled:true});
await writeData(d=>{d.saved['${isbn}'].watch.nextCheckAt=0;return d;});
await chrome.alarms.create('saved-book-check',{when:Date.now()+100});});
`
  );
  const browserType = withExtension(firefox, resolve(root, 'extension'));
  // The helper assumes static content scripts. Grant the manifest hosts in this isolated test profile instead.
  browserType.overridePermissions = async profile => {
    const manifest = JSON.parse(await readFile(root + '/extension/manifest.json', 'utf8'));
    await mkdir(profile, { recursive: true });
    await writeFile(
      profile + '/extension-preferences.json',
      JSON.stringify({
        'livros-mais-baratos-pt@rfsbraz.github.io': {
          permissions: [],
          origins: manifest.host_permissions
        }
      })
    );
  };
  const context = await browserType.launchPersistentContext(root + '/profile', {
    headless: true,
    firefoxUserPrefs: {
      'extensions.webextensions.uuids': JSON.stringify({
        'livros-mais-baratos-pt@rfsbraz.github.io': uuid
      })
    }
  });
  try {
    const page = await context.newPage();

    await page.route('https://www.wook.pt/**', r =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><h1>Livro Firefox</h1><script type="application/ld+json">${JSON.stringify({ '@type': 'Book', isbn, name: 'Livro Firefox', offers: { price: '20.00', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } })}</script>`
      })
    );
    await page.goto('https://www.wook.pt/livro/test');
    await expect(page.locator('#lmb-price-alert')).toBeVisible({ timeout: 30000 });
    await expect
      .poll(
        async () =>
          JSON.parse((await page.locator('html').getAttribute('data-fixture-state')) || '{}').cache,
        { timeout: 30000 }
      )
      .toBe(2);
    await expect
      .poll(
        async () =>
          JSON.parse((await page.locator('html').getAttribute('data-fixture-state')) || '{}'),
        { timeout: 30000 }
      )
      .toEqual(expect.objectContaining({ notices: 1 }));
    await page.screenshot({ path: 'work/firefox-alert.png', fullPage: true });
  } finally {
    await context.close();
  }
});
