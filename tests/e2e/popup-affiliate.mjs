import { chromium, firefox } from 'playwright';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { affiliateUrl } from '../../affiliate.js';

const kind = process.argv[2] === 'firefox' ? 'firefox' : 'chrome';
const isbn = '9780306406157';
const termsUrl = 'https://www.wook.pt/Mensagem/index/?key=leitura-em-festa';
const date = new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'Europe/Lisbon',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
}).format(new Date());
const terms = `Encomendas registadas e pagas no dia ${date}, Portugal Continental. O valor pago será devolvido sob a forma de vale de compras (VALE 100%), 15 dias após o envio da totalidade da encomenda. O vale não é reembolsável em dinheiro. Validade do vale: 60 dias. Até ao limite de 50% do valor total da encomenda.`;
const product = price =>
  `<html><head><title>Livro de teste</title><script type="application/ld+json">${JSON.stringify({ '@type': 'Book', isbn, name: 'Livro de teste', offers: { price, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } })}</script></head><body><h1>Livro de teste</h1><div class="sale-container"><div class="wook-container"><a href="${termsUrl}">Leitura em festa</a></div></div></body></html>`;
const wookProduct = 'https://www.wook.pt/livro/teste';
const bertrandSearch = `https://www.bertrand.pt/pesquisa/${isbn}`;
const mbooksSearch = `https://mbooks.pt/?s=${isbn}&post_type=product`;
const almedinaSearch = `https://www.almedina.net/catalogsearch/result/?q=${isbn}`;
const hasAid = url => {
  try {
    const params = new URL(url).searchParams;
    return params.has('a_aid') || params.has('wpam_id');
  } catch {
    return false;
  }
};

await mkdir('work', { recursive: true });
const root = await mkdtemp(resolve(`work/popup-affiliate-${kind}-`));
const src = kind === 'firefox' ? 'dist/firefox' : 'dist/chrome';
await cp(src, `${root}/extension`, { recursive: true });
const fetchStub = `globalThis.fetch = async (url, options) => {
  options?.signal?.throwIfAborted();
  const href = String(url);
  if (href.includes('/Mensagem/')) {
    const response = new Response(${JSON.stringify(terms)}, {status:200,headers:{'Content-Type':'text/html'}});
    Object.defineProperty(response,'url',{value:href});
    return response;
  }
  if (new URL(url).origin === 'https://www.wook.pt') {
    const response = new Response(${JSON.stringify(product('18.00'))}, {status:200,headers:{'Content-Type':'text/html'}});
    Object.defineProperty(response,'url',{value:${JSON.stringify(wookProduct)}});
    return response;
  }
  await new Promise(r => setTimeout(r, 3500));
  options?.signal?.throwIfAborted();
  return new Response('blocked', {status:403});
};
`;
await writeFile(`${root}/extension/compare.js`, fetchStub + (await readFile('compare.js', 'utf8')));
if (kind === 'firefox') {
  await writeFile(
    `${root}/extension/offscreen.js`,
    fetchStub + (await readFile('offscreen.js', 'utf8'))
  );
}
const background = await readFile(`${root}/extension/background.js`, 'utf8');
await writeFile(
  `${root}/extension/background.js`,
  background.replace(
    'writeData(message.action)',
    "Promise.resolve(message.action?.type==='migrate'?new Promise(r=>setTimeout(r,1500)):null).then(()=>writeData(message.action))"
  )
);
const popupSource = await readFile(`${root}/extension/popup.js`, 'utf8');
if (!popupSource.includes('function showBook(book) {\n  current = book;')) {
  throw new Error('showBook hook point missing');
}
await writeFile(
  `${root}/extension/popup.js`,
  popupSource.replace(
    'function showBook(book) {\n  current = book;',
    `function showBook(book) {
  current = book;
  const ref = Number(new URLSearchParams(location.search).get('ref'));
  if (!current.referencePrice && Number.isSafeInteger(ref) && ref > 0) {
    current.referencePrice = ref;
  }`
  )
);

// Firefox refuses Playwright automation of privileged moz-extension pages, so
// that browser loads the popup over HTTP with the same chrome.storage delay.
const serveRoot = resolve(root, 'extension');
const server = createServer(async (req, res) => {
  try {
    const file = resolve(serveRoot, `.${new URL(req.url, 'http://localhost').pathname}`);
    if (!file.startsWith(serveRoot + sep)) {
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

let context;
if (kind === 'firefox') {
  context = await firefox.launchPersistentContext(`${root}/profile`, { headless: true });
} else {
  context = await chromium.launchPersistentContext(`${root}/profile`, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${root}/extension`, `--load-extension=${root}/extension`]
  });
}

async function extensionId() {
  const settings = await context.newPage();
  await settings.goto('chrome://extensions');
  const id = await settings.evaluate(
    async () =>
      (await chrome.developerPrivate.getExtensionsInfo({})).find(
        e => e.name === 'Livros Mais Baratos PT'
      ).id
  );
  await settings.close();
  return id;
}

async function waitForNewPage(pagesBefore, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const page = context.pages().find(p => !pagesBefore.has(p));
    if (page) {
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 3000 });
      } catch {
        /* The fulfilled fixture may already be loaded. */
      }
      return page;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('No tab opened');
}

const asserted = [];
let failed;
try {
  await context.route('https://**/*', route =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body>ok</body></html>'
    })
  );
  const page = await context.newPage();
  if (kind === 'firefox') {
    await page.addInitScript(() => {
      window.__data = {
        selectedStores: ['wook', 'bertrand', 'mbooks', 'almedina'],
        autoEnabled: false
      };
      const listeners = [];
      window.chrome = {
        runtime: { getManifest: () => ({ version: '0.1.9' }) },
        storage: {
          onChanged: { addListener: fn => listeners.push(fn) },
          local: {
            remove: async keys => {
              for (const key of [].concat(keys)) {
                delete window.__data[key];
              }
            },
            get: async keys => {
              const first = !window.__storageReady;
              window.__storageReady = true;
              if (first) {
                await new Promise(r => setTimeout(r, 1500));
              }
              if (!keys) {
                return { ...window.__data };
              }
              const wanted = Array.isArray(keys) ? keys : Object.keys(keys);
              return Object.fromEntries(wanted.map(key => [key, window.__data[key]]));
            },
            set: async data => {
              window.__data = { ...window.__data, ...data };
              const changes = Object.fromEntries(
                Object.entries(data).map(([key, value]) => [key, { newValue: value }])
              );
              for (const fn of listeners) {
                fn(changes, 'local');
              }
            }
          }
        },
        permissions: { contains: async () => true },
        alarms: { create: async () => {}, clear: async () => true, get: async () => null },
        tabs: { query: async () => [] },
        scripting: { executeScript: async () => [] }
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/popup.html?ref=2000`);
  } else {
    const id = await extensionId();
    const sw =
      context.serviceWorkers().find(worker => worker.url().includes(id)) ||
      (await context.waitForEvent('serviceworker', { timeout: 15000 }));
    await sw.evaluate(async () => {
      await chrome.storage.local.set({
        selectedStores: ['wook', 'bertrand', 'mbooks', 'almedina'],
        autoEnabled: false
      });
    });
    await page.goto(`chrome-extension://${id}/popup.html?ref=2000`);
  }
  await page.evaluate(isbn => {
    const timer = setInterval(() => {
      const form = document.getElementById('search');
      const input = document.getElementById('isbn');
      if (form && input) {
        input.value = isbn;
        form.requestSubmit();
        clearInterval(timer);
      }
    }, 10);
  }, isbn);
  await page.locator('#results .offer > a, #unconfirmed-results a').first().waitFor({
    timeout: 20000
  });
  await page.locator('#unconfirmed').evaluate(e => e.setAttribute('open', ''));
  await page.locator('#manual-section').evaluate(e => e.setAttribute('open', ''));
  // Wait until the delayed migrate / storage load in init has finished, then
  // snapshot hrefs before the cache rewrite can drop unconfirmed rows.
  await page.waitForTimeout(2000);
  const snapshot = await page.evaluate(() => {
    const href = (root, name) =>
      [...document.querySelectorAll(root)].find(a => a.textContent.includes(name))?.href || null;
    return {
      status: document.querySelector('#status')?.textContent,
      wook: href('#results .offer > a', 'Wook') || href('#unconfirmed-results a', 'Wook'),
      banner: document.querySelector('#cheapest-banner-link')?.href || null,
      bannerHidden: document.querySelector('#cheapest-banner')?.hidden ?? null,
      promotion: document.querySelector('.voucher-promotion a')?.href || null,
      bertrand: href('#unconfirmed-results a', 'Bertrand'),
      mbooks: href('#unconfirmed-results a', 'mbooks'),
      almedina: href('#unconfirmed-results a', 'Almedina'),
      fnac: document.querySelector('#manual-results a')?.href || null
    };
  });
  asserted.push({ phase: 'hrefs-after-storage', snapshot });
  const withReferral = (url, label) => {
    assert.ok(url, `${label} should already be on screen`);
    const bare = new URL(url);
    bare.searchParams.delete('a_aid');
    bare.searchParams.delete('wpam_id');
    assert.equal(url, affiliateUrl(bare.href, true), label);
  };
  withReferral(snapshot.wook, 'AC3: Wook row carries the referral once the preference is on');
  withReferral(snapshot.bertrand, 'AC3: unconfirmed partner href');
  if (snapshot.banner && snapshot.bannerHidden === false) {
    withReferral(snapshot.banner, 'AC3: cheapest banner href');
  }
  if (snapshot.promotion) {
    withReferral(snapshot.promotion, 'AC3: promotion more href');
  }
  if (snapshot.almedina) {
    assert.equal(snapshot.almedina, almedinaSearch, 'AC4: stores without a partner stay unchanged');
    assert.ok(!hasAid(snapshot.almedina));
  }
  assert.ok(
    snapshot.fnac && !hasAid(snapshot.fnac),
    'AC4: manual rows without a partner stay unchanged'
  );

  await page.locator('#results .offer > a').filter({ hasText: 'Wook' }).waitFor({ timeout: 20000 });
  await page.locator('#cheapest-banner-link').waitFor({ timeout: 20000 });
  await page.locator('.voucher-promotion a').waitFor({ timeout: 20000 });
  if (
    (await page.locator('#unconfirmed-results a').filter({ hasText: 'Bertrand' }).count()) === 0
  ) {
    await page.getByRole('button', { name: 'Comparar', exact: true }).click();
    await page.locator('#unconfirmed-results a').filter({ hasText: 'Bertrand' }).waitFor({
      timeout: 20000
    });
  }
  if ((await page.locator('#unconfirmed-results a').filter({ hasText: 'mbooks' }).count()) === 0) {
    await page.getByRole('button', { name: 'Comparar', exact: true }).click();
    await page.locator('#unconfirmed-results a').filter({ hasText: 'mbooks' }).waitFor({
      timeout: 20000
    });
  }
  const mbooksHref = await page
    .locator('#unconfirmed-results a')
    .filter({ hasText: 'mbooks' })
    .getAttribute('href');
  withReferral(mbooksHref, 'AC3: unconfirmed mbooks href');
  assert.equal(
    new URL(mbooksHref).searchParams.get('wpam_id'),
    '163',
    'AC3: mbooks href carries wpam_id=163 once the preference is on'
  );
  assert.equal(
    new URL(mbooksHref).searchParams.get('s'),
    isbn,
    'AC3: mbooks keeps the existing search query'
  );
  assert.equal(
    new URL(mbooksHref).searchParams.get('post_type'),
    'product',
    'AC3: mbooks keeps the existing post_type query'
  );
  const hrefs = {
    fnac: snapshot.fnac
  };

  async function openFrom(locator, mode) {
    const pagesBefore = new Set(context.pages());
    if (mode === 'middle') {
      await locator.click({ button: 'middle' });
    } else if (mode === 'enter') {
      await locator.focus();
      await page.keyboard.press('Enter');
    } else {
      await locator.click();
    }
    const opened = await waitForNewPage(pagesBefore);
    const url = opened.url();
    await opened.close().catch(() => {});
    return url;
  }

  async function assertOpen(label, locator, expected, mode = 'mouse') {
    const url = await openFrom(locator, mode);
    asserted.push({ phase: `open:${label}:${mode}`, url });
    assert.equal(url, expected, `${label} ${mode} opened ${url}`);
    return url;
  }

  const wookLink = page.locator('#results .offer > a').filter({ hasText: 'Wook' });
  await assertOpen('result-wook', wookLink, affiliateUrl(wookProduct, true), 'mouse');
  await assertOpen('result-wook', wookLink, affiliateUrl(wookProduct, true), 'middle');
  await assertOpen('result-wook', wookLink, affiliateUrl(wookProduct, true), 'enter');
  await assertOpen(
    'banner',
    page.locator('#cheapest-banner-link'),
    affiliateUrl(wookProduct, true)
  );
  await assertOpen('promotion', page.locator('.voucher-promotion a'), affiliateUrl(termsUrl, true));
  await assertOpen(
    'unconfirmed-bertrand',
    page.locator('#unconfirmed-results a').filter({ hasText: 'Bertrand' }),
    affiliateUrl(bertrandSearch, true)
  );
  await assertOpen(
    'unconfirmed-mbooks',
    page.locator('#unconfirmed-results a').filter({ hasText: 'mbooks' }),
    affiliateUrl(mbooksSearch, true)
  );
  await assertOpen(
    'unconfirmed-almedina',
    page.locator('#unconfirmed-results a').filter({ hasText: 'Almedina' }),
    almedinaSearch
  );
  await assertOpen('manual-fnac', page.locator('#manual-results a').first(), hrefs.fnac);

  await page.locator('#open-settings').click();
  await page.locator('#affiliate-toggle').uncheck();
  await page.locator('#close-settings').click();
  assert.equal(
    await page.locator('#results .offer > a').filter({ hasText: 'Wook' }).getAttribute('href'),
    wookProduct,
    'AC2: turning the option off removes the referral from links already on screen'
  );
  await assertOpen('result-wook-off', wookLink, wookProduct);
  await assertOpen('banner-off', page.locator('#cheapest-banner-link'), wookProduct);
  await assertOpen('promotion-off', page.locator('.voucher-promotion a'), termsUrl);
  await assertOpen(
    'unconfirmed-bertrand-off',
    page.locator('#unconfirmed-results a').filter({ hasText: 'Bertrand' }),
    bertrandSearch
  );
  await assertOpen(
    'unconfirmed-mbooks-off',
    page.locator('#unconfirmed-results a').filter({ hasText: 'mbooks' }),
    mbooksSearch
  );
  await assertOpen(
    'unconfirmed-almedina-off',
    page.locator('#unconfirmed-results a').filter({ hasText: 'Almedina' }),
    almedinaSearch
  );

  console.log(`popup-affiliate ${kind} asserted URLs:`);
  for (const entry of asserted) {
    console.log(JSON.stringify(entry));
  }
} catch (error) {
  failed = error;
} finally {
  await context.close().catch(() => {});
  await new Promise(r => server.close(r));
}
if (failed) {
  console.error(failed);
  process.exit(1);
}
process.exit(0);
