import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('dist/chrome');
const server = createServer(async (req, res) => {
  try {
    const file = resolve(root, `.${new URL(req.url, 'http://localhost').pathname}`);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const content = await readFile(file);
    res.setHeader(
      'Content-Type',
      { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] ||
        'application/octet-stream'
    );
    res.end(content);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const isbn = '9780306406157';
function product(price, currency = 'EUR', stock = 'InStock', id = isbn) {
  return `<html><head><title>Livro de teste</title><script type="application/ld+json">${JSON.stringify({ '@type': 'Book', isbn: id, name: 'Uma pequena biblioteca', offers: { price, priceCurrency: currency, availability: `https://schema.org/${stock}` } })}</script></head><body><h1>Uma pequena biblioteca</h1></body></html>`;
}
try {
  await page.addInitScript(
    ({ html }) => {
      window.__data = JSON.parse(
        localStorage.getItem('testData') ||
          '{"selectedStores":["wook","bertrand","almedina","bookcover"]}'
      );
      window.__permission = true;
      window.chrome = {
        runtime: { getManifest: () => ({ version: '0.1.5' }) },
        storage: {
          local: {
            remove: async keys => {
              for (const key of keys) {
                delete window.__data[key];
              }
            },
            get: async () => window.__data,
            set: async data => {
              window.__data = { ...window.__data, ...data };
              localStorage.setItem('testData', JSON.stringify(window.__data));
            }
          }
        },
        permissions: {
          contains: async request => {
            window.__requested = request;
            return window.__permission;
          }
        },
        tabs: { query: async () => [{ id: 1, url: 'https://www.wook.pt/livro/example' }] },
        scripting: { executeScript: async () => [{ result: { html } }] }
      };
    },
    { html: product('20.00') }
  );
  await page.route('https://**/*', route =>
    route.fulfill({ status: 403, body: 'Unconfigured test store' })
  );
  await page.route('https://www.wook.pt/**', route =>
    route.fulfill({ contentType: 'text/html', body: product('18.00') })
  );
  await page.route('https://www.bertrand.pt/**', route =>
    route.fulfill({ contentType: 'text/html', body: product('17.00') })
  );
  await page.route('https://www.almedina.net/**', route =>
    route.fulfill({ status: 403, body: 'Blocked' })
  );
  await page.route('https://bookcover.pt/**', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          sku: isbn,
          type: 'simple',
          name: 'Uma pequena biblioteca',
          prices: { price: '1200', currency_code: 'EUR', currency_minor_unit: 2 },
          permalink: 'https://bookcover.pt/product/test/',
          is_in_stock: false
        }
      ])
    })
  );
  await page.goto(`http://127.0.0.1:${server.address().port}/popup.html`);
  await page.waitForFunction(() => document.querySelector('#isbn').value === '9780306406157');
  const promoCheck = await page.evaluate(async () => {
    const { parseOffer } = await import('./parser.js');
    const { enrichPromotion, parseVoucherTerms } = await import('./promotions.js');
    const { promotionCard } = await import('./promotion-view.js');
    const { cachePrices, cachedPrices } = await import('./price-cache.js');
    const now = Date.parse('2026-11-04T12:00:00Z');
    const url = 'https://www.wook.pt/livro/teste/123';
    const termsUrl = 'https://www.wook.pt/Mensagem/index/?key=nome-alterado';
    const terms =
      'Encomendas registadas e pagas nos dias 4 e 5 de novembro de 2026, Portugal Continental. O valor pago será devolvido sob a forma de vale de compras (VALE 100%), 15 dias após o envio da totalidade da encomenda. O vale não é reembolsável em dinheiro. Validade do vale: 60 dias. Até ao limite de 50% do valor total da encomenda.';
    const json = JSON.stringify({
      '@type': 'Book',
      isbn: '9780306406157',
      name: 'Exemplo',
      offers: { price: '18.85', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' }
    });
    const html = `<script type="application/ld+json">${json}</script><h1>Exemplo</h1><div class="sale-container"><div class="wook-container"><a href="${termsUrl}">Festa da leitura</a></div></div>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const offer = parseOffer(doc, '9780306406157', url);
    let requests = 0;
    const loader = async target => {
      if (target !== termsUrl) {
        throw new Error('Unexpected destination');
      }
      requests++;
      return new DOMParser().parseFromString(`<main>${terms}</main>`, 'text/html');
    };
    const [enriched, second] = await Promise.all([
      enrichPromotion(offer, loader, new AbortController().signal, now),
      enrichPromotion(offer, loader, new AbortController().signal, now)
    ]);
    const failed = await enrichPromotion(
      { ...offer, promotionUrl: termsUrl.replace('nome-alterado', 'indisponivel') },
      async () => {
        throw new Error('HTTP 403');
      },
      new AbortController().signal,
      now
    );
    if (failed.promotion || failed.price !== 1885) {
      throw new Error('Failed campaign must preserve price only');
    }
    const full = { ...enriched, id: 'wook', status: 'ok' };
    const cached = cachedPrices(
      cachePrices({}, '9780306406157', [full], now, now),
      '9780306406157',
      ['wook'],
      now
    );
    window.__promotionEnabled = true;
    const card = promotionCard(cached.offers[0], () => window.__promotionEnabled, now);
    card.id = 'promotion-fixture';
    document.body.append(card);
    card.querySelector('a').addEventListener('click', e => {
      e.preventDefault();
      window.__promotionClicked = e.currentTarget.href;
    });
    const unrelated = new DOMParser().parseFromString(
      html.replace('sale-container', 'recommendations'),
      'text/html'
    );
    return {
      price: enriched.price,
      requests,
      second: !!second.promotion,
      unrelated: parseOffer(unrelated, '9780306406157', url).promotionUrl,
      invalidIsbn: parseOffer(doc, '9789720046710', url),
      parsed: !!parseVoucherTerms(terms, termsUrl, now)
    };
  });
  assert.deepEqual(promoCheck, {
    price: 1885,
    requests: 1,
    second: true,
    unrelated: null,
    invalidIsbn: null,
    parsed: true
  });
  assert((await page.locator('#promotion-fixture').textContent()).includes('33,3%'));
  assert((await page.locator('#promotion-fixture').textContent()).includes('37,70'));
  assert(!(await page.locator('#promotion-fixture').textContent()).includes('Ligação de afiliado'));
  assert((await page.locator('#promotion-fixture a').getAttribute('href')).includes('a_aid'));
  await page.locator('#promotion-fixture a').click();
  assert((await page.evaluate(() => window.__promotionClicked)).includes('a_aid=5d3ee4327c2fd'));
  await page.evaluate(() => {
    window.__promotionEnabled = false;
  });
  await page.locator('#promotion-fixture a').click();
  assert(!(await page.evaluate(() => window.__promotionClicked)).includes('a_aid'));
  await page.locator('#promotion-fixture').evaluate(e => e.remove());

  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '3 de 4' }).waitFor();
  assert.equal(await page.locator('.best a').textContent(), 'Bertrand');
  assert.equal(await page.locator('.offer').count(), 4);
  assert.equal(await page.locator('#affiliate-toggle').isChecked(), true);
  await page.route('https://www.wook.pt/**', route =>
    route.fulfill({ contentType: 'text/html', body: product('16.00') })
  );
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '3 de 4' }).waitFor();
  async function captureWookClick() {
    await page
      .locator('#results a')
      .filter({ hasText: 'Wook' })
      .evaluate(a => {
        a.addEventListener(
          'click',
          e => {
            e.preventDefault();
            window.__clicked = a.href;
          },
          { once: true }
        );
      });
    await page.locator('#results a').filter({ hasText: 'Wook' }).click();
    return page.evaluate(() => window.__clicked);
  }
  assert(
    (await page.locator('#results a').filter({ hasText: 'Wook' }).getAttribute('href')).includes(
      'a_aid=5d3ee4327c2fd'
    ),
    'the link carries the id before any click, so a copied link has it too'
  );
  assert((await captureWookClick()).includes('a_aid=5d3ee4327c2fd'));
  assert.doesNotMatch(await page.locator('footer').textContent(), /afiliad/i);
  assert.equal(await page.locator('#settings-view').isVisible(), false);
  await page.locator('#open-settings').click();
  assert.equal(await page.locator('#main-view').isVisible(), false);
  await page.locator('#affiliate-toggle').uncheck();
  await page.locator('#close-settings').click();
  assert.equal(await page.locator('#results .offer').count(), 3);
  await page.waitForFunction(() => window.__data.affiliateEnabled === false);
  assert(!(await captureWookClick()).includes('a_aid'));
  await page.locator('#results a').filter({ hasText: 'Wook' }).dispatchEvent('contextmenu');
  assert(
    !(await page.locator('#results a').filter({ hasText: 'Wook' }).getAttribute('href')).includes(
      'a_aid'
    ),
    'turning the option off also cleans a link that is already on screen'
  );
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#isbn').value === '9780306406157');

  assert.equal(await page.locator('#affiliate-toggle').isChecked(), false);
  await page.getByRole('status').filter({ hasText: 'Preços guardados:' }).waitFor();
  assert.equal(
    await page.locator('#results .offer').count(),
    3,
    'reopening restores prices without comparing'
  );
  await page.route('https://www.wook.pt/**', route =>
    route.fulfill({ contentType: 'text/html', body: product('18.00') })
  );
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '3 de 4' }).waitFor();

  assert.match(await page.locator('#results').textContent(), /Sem stock/);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Livro guardado' }).waitFor();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#count').textContent === '1');
  assert.equal(await page.evaluate(() => window.__data.history['9780306406157'].length), 9);
  // The dearest offer in the list still carries the id.
  await page.locator('#open-settings').click();
  await page.locator('#affiliate-toggle').check();
  await page.locator('#close-settings').click();
  await page.route('https://www.wook.pt/**', route =>
    route.fulfill({ contentType: 'text/html', body: product('99.00') })
  );
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.locator('#results .offer').filter({ hasText: '99,00' }).waitFor();
  assert(
    (await page.locator('#results a').filter({ hasText: 'Wook' }).getAttribute('href')).includes(
      'a_aid=5d3ee4327c2fd'
    )
  );
  // Parser regressions: wrong edition, script injection, currency and search/product separation.
  const parsed = await page.evaluate(
    async ({ good, wrong }) => {
      const { parseOffer, detectBook, productLinks } = await import('./parser.js');
      const { STORES } = await import('./core.js');
      const parse = s => new DOMParser().parseFromString(s, 'text/html');
      return {
        good: parseOffer(parse(good), '9780306406157', 'https://www.wook.pt/livro/example')?.price,
        wook: parseOffer(
          parse(
            '<script type="application/ld+json">{"@type":"Book","isbn":"9789895701124","name":"A Criada","offers":{"price":"19.46"}}</script><div id="product-price"><span class="price">19,46€</span></div><div class="price">1,00€</div>'
          ),
          '9789895701124',
          'https://www.wook.pt/livro/a-criada-freida-mcfadden/28535345'
        )?.price,
        // Wook's real shape: no availability in JSON-LD, the label in #disp-information.
        wookStock: (() => {
          const isbn = '9789895701124';
          const page = (label, offers = '{"price":"19.46"}', extra = '') =>
            parse(
              `<script type="application/ld+json">{"@type":"Book","isbn":"${isbn}","name":"A Criada","offers":${offers}}</script><div id="product-price"><span class="price">19,46€</span></div><span id="disp-information"><span class="text-align-right"><span class="text-green font-bold"> ${label} </span><span>-</span></span><button>i</button></span>${extra}`
            );
          const wook = 'https://www.wook.pt/livro/a-criada-freida-mcfadden/28535345';
          const modal = '<div id="info-availability-toggle-modal"><p>EM STOCK</p></div>';
          return {
            label: parseOffer(page('EM STOCK'), isbn, wook).availability,
            empty: parseOffer(page('', undefined, modal), isbn, wook).availability,
            prelaunch: parseOffer(page('PRÉ-LANÇAMENTO', undefined, modal), isbn, wook)
              .availability,
            structuredWins: parseOffer(
              page(
                'EM STOCK',
                '{"price":"19.46","priceCurrency":"EUR","availability":"https://schema.org/OutOfStock"}'
              ),
              isbn,
              wook
            ).availability,
            otherStore: parseOffer(
              page('EM STOCK', '{"price":"19.46","priceCurrency":"EUR"}'),
              isbn,
              'https://www.bertrand.pt/livro/a-criada/28535345'
            ).availability,
            otherEdition: parseOffer(page('EM STOCK'), '9780306406157', wook)
          };
        })(),
        wrong: parseOffer(parse(wrong), '9780306406157', 'https://www.wook.pt/livro/example'),
        malformed: detectBook(parse('<script type="application/ld+json">broken</script>')).isbn,
        links: productLinks(
          parse('<a href="https://evil.test/livro/steal">bad</a><a href="/livro/good">good</a>'),
          STORES[0],
          STORES[0].origin
        )
      };
    },
    { good: product('18.00'), wrong: product('1.00', 'EUR', 'InStock', '9780804429573') }
  );
  assert.equal(parsed.good, 1800);
  assert.equal(parsed.wook, 1946);
  assert.deepEqual(parsed.wookStock, {
    label: 'InStock',
    empty: '',
    prelaunch: '',
    structuredWins: 'OutOfStock',
    otherStore: '',
    otherEdition: null
  });
  assert.equal(parsed.wrong, null);
  assert.equal(parsed.malformed, null);
  assert.deepEqual(parsed.links, ['https://www.wook.pt/livro/good']);
  const fixtures = JSON.parse(await readFile('tests/fixtures/store-shapes.json', 'utf8')).cases;
  const fixtureResults = await page.evaluate(async cases => {
    const { parseOffer, detectBook } = await import('./parser.js');
    return cases.map(c => {
      const doc = new DOMParser().parseFromString(c.html, 'text/html');
      return {
        store: c.store,
        offer: parseOffer(doc, c.isbn, c.url),
        detected: detectBook(doc, c.url).isbn,
        wrong: parseOffer(doc, '9780306406157', c.url)
      };
    });
  }, fixtures);
  for (let i = 0; i < fixtures.length; i++) {
    const expected = fixtures[i],
      actual = fixtureResults[i];
    assert.equal(actual.offer?.price, expected.price, `${expected.store}: observed price shape`);
    assert.equal(actual.offer?.currency, expected.currency, `${expected.store}: currency`);
    assert.equal(actual.detected, expected.isbn, `${expected.store}: detected ISBN`);
    assert.equal(actual.wrong, null, `${expected.store}: wrong edition must be rejected`);
  }
  assert.equal(await page.locator('.shop-option').count(), 26);
  assert.equal(await page.locator('#manual-results .manual-row').count(), 17);
  const fallback = await page.evaluate(
    async ({ good, wrong }) => {
      const { compareStore } = await import('./compare.js');
      const { STORES } = await import('./stores.js');
      const store = STORES.find(s => s.id === 'gradiva'),
        fetched = [];
      const result = await compareStore(
        store,
        '9780306406157',
        new AbortController().signal,
        async url => {
          fetched.push(url);
          let html;
          if (url.includes('s=978')) {
            html =
              '<a href="/produto/wrong/">Other edition</a><a href="/produto/cart/?add-to-cart=1">Add</a>';
          } else if (url.includes('s=')) {
            html = '<a href="/produto/right/">Exact edition</a>';
          } else {
            html = url.includes('/right/') ? good : wrong;
          }
          return new DOMParser().parseFromString(html, 'text/html');
        },
        'The title'
      );
      return { status: result.status, price: result.price, fetched };
    },
    { good: product('18.00'), wrong: product('1.00', 'EUR', 'InStock', '9780804429573') }
  );
  assert.equal(fallback.status, 'ok');
  assert.equal(fallback.price, 1800);
  assert.equal(fallback.fetched.length, 4);
  assert(!fallback.fetched.some(url => url.includes('add-to-cart')));
  const apiComparisons = await page.evaluate(async html => {
    const { compareStore } = await import('./compare.js');
    const { STORES } = await import('./stores.js');
    const originalFetch = window.fetch;
    const results = [];
    try {
      for (const id of ['penguin', 'devir', 'gradiva', 'guerraepaz', 'relogiodagua', 'mbooks']) {
        const store = STORES.find(s => s.id === id);
        const path =
          id === 'devir'
            ? '/livro/exemplo/'
            : id === 'penguin'
              ? '/loja/penguin/livro/exemplo/'
              : '/produto/exemplo/';
        const url = store.origin + path;
        let pageRequests = 0;
        let price = '1600';
        let fail = false;
        window.fetch = async endpoint => {
          if (fail) {
            throw new Error('HTTP 503');
          }
          const response = new Response(
            JSON.stringify([
              {
                id: 123,
                type: 'simple',
                sku: 'INTERNAL',
                permalink: url,
                prices: { price, currency_code: 'EUR', currency_minor_unit: 2 },
                is_in_stock: true
              }
            ])
          );
          Object.defineProperty(response, 'url', { value: endpoint });
          return response;
        };
        const loader = async target => {
          pageRequests++;
          return new DOMParser().parseFromString(
            target === url ? html : `<a href="${path}">Livro</a>`,
            'text/html'
          );
        };
        const compare = () =>
          compareStore(store, '9780306406157', new AbortController().signal, loader);
        const first = await compare();
        const initialRequests = pageRequests;
        pageRequests = 0;
        price = '1400';
        const second = await compare();
        const updateRequests = pageRequests;
        fail = true;
        const fallback = await compare();
        results.push({
          id,
          initialRequests,
          updateRequests,
          fallbackRequests: pageRequests,
          first: first.price,
          second: second.price,
          fallback: fallback.price
        });
      }
    } finally {
      window.fetch = originalFetch;
    }
    return results;
  }, product('18.00'));
  for (const result of apiComparisons) {
    assert.equal(result.first, 1600, result.id);
    assert.equal(result.second, 1400, result.id);
    assert.equal(result.fallback, 1800, result.id);
    assert.equal(result.initialRequests, 2, result.id);
    assert.equal(result.updateRequests, 0, result.id);
    assert.equal(result.fallbackRequests, 2, result.id);
  }
  const shopifyComparisons = await page.evaluate(
    async ({ good, wrong }) => {
      const { compareStore } = await import('./compare.js');
      const { STORES } = await import('./stores.js');
      const originalFetch = window.fetch;
      const results = [];
      try {
        for (const id of ['presenca', 'antigona', 'kingpin']) {
          const store = STORES.find(s => s.id === id);
          for (const empty of [false, true]) {
            const pages = [];
            window.fetch = async endpoint => {
              const response = new Response(
                JSON.stringify({
                  resources: {
                    results: {
                      products: empty
                        ? []
                        : [
                            { url: '/products/wrong', price: '0.01' },
                            { url: '/products/right?_pos=2', price: '0.01' }
                          ]
                    }
                  }
                })
              );
              Object.defineProperty(response, 'url', { value: endpoint });
              return response;
            };
            const result = await compareStore(
              store,
              '9780306406157',
              new AbortController().signal,
              async url => {
                pages.push(url);
                const html = url.includes('/search')
                  ? '<a href="/products/right">Livro</a>'
                  : url.includes('/wrong')
                    ? wrong
                    : good;
                return new DOMParser().parseFromString(html, 'text/html');
              }
            );
            results.push({ id, empty, status: result.status, price: result.price, pages });
          }
        }
      } finally {
        window.fetch = originalFetch;
      }
      return results;
    },
    { good: product('18.00'), wrong: product('1.00', 'EUR', 'InStock', '9780804429573') }
  );
  for (const result of shopifyComparisons) {
    assert.equal(result.status, 'ok', result.id);
    assert.equal(result.price, 1800, result.id);
    assert.equal(result.pages.length, 2, result.id);
    assert.equal(
      result.pages.some(url => url.includes('/search')),
      result.empty,
      result.id
    );
  }
  const shopifyDetails = await page.evaluate(async html => {
    const { compareStore } = await import('./compare.js');
    const { STORES } = await import('./stores.js');
    const originalFetch = window.fetch;
    const results = [];
    try {
      for (const id of ['presenca', 'antigona', 'kingpin']) {
        const store = STORES.find(s => s.id === id);
        let price = 1600,
          pages = 0;
        const requests = [];
        window.fetch = async endpoint => {
          requests.push(new URL(endpoint).pathname);
          const payload = endpoint.includes('/search/')
            ? { resources: { results: { products: [{ url: '/products/details' }] } } }
            : endpoint.endsWith('/cart.js')
              ? { currency: 'EUR' }
              : {
                  id: 901,
                  handle: 'details',
                  variants: [
                    {
                      id: 902,
                      sku: id === 'antigona' ? 'internal' : '9780306406157',
                      price,
                      available: true
                    }
                  ]
                };
          const response = new Response(JSON.stringify(payload), {
            headers: { 'Content-Type': 'text/javascript' }
          });
          Object.defineProperty(response, 'url', { value: endpoint });
          return response;
        };
        const compare = () =>
          compareStore(store, '9780306406157', new AbortController().signal, async () => {
            pages++;
            return new DOMParser().parseFromString(html, 'text/html');
          });
        const first = await compare();
        const initialPages = pages;
        pages = 0;
        requests.length = 0;
        price = 1400;
        const second = await compare();
        results.push({
          id,
          first: first.price,
          second: second.price,
          initialPages,
          pages,
          requests: [...requests]
        });
      }
    } finally {
      window.fetch = originalFetch;
    }
    return results;
  }, product('18.00'));
  for (const result of shopifyDetails) {
    assert.equal(result.first, 1600, result.id);
    assert.equal(result.second, 1400, result.id);
    assert.equal(result.initialPages, result.id === 'antigona' ? 1 : 0, result.id);
    assert.equal(result.pages, 0, result.id);
    assert.deepEqual(result.requests, ['/products/details.js', '/cart.js'], result.id);
  }
  await page.locator('#isbn').fill('9780306406158');
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'válido' }).waitFor();
  await page.locator('#isbn').fill(isbn);
  await page.evaluate(() => {
    window.__permission = false;
  });
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Acesso não autorizado' }).waitFor();
  await page.locator('#open-settings').click();
  assert.equal(await page.locator('#auto-toggle').getAttribute('aria-pressed'), 'true');
  await page.locator('#auto-toggle').click();
  await page.getByRole('status').filter({ hasText: 'Avisos automáticos desativados' }).waitFor();
  await page.locator('#auto-toggle').click();
  await page.getByRole('status').filter({ hasText: 'avisos continuam desativados' }).waitFor();
  await page.evaluate(() => {
    window.__permission = true;
  });
  await page.locator('#auto-toggle').click();
  await page.getByRole('status').filter({ hasText: 'Avisos ativos' }).waitFor();
  assert.equal(await page.evaluate(() => window.__data.autoEnabled), true);
  await page.locator('#auto-toggle').click();
  await page.getByRole('status').filter({ hasText: 'Avisos automáticos desativados' }).waitFor();
  assert.equal(await page.evaluate(() => window.__data.autoEnabled), false);
  await page.locator('#close-settings').click();
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '3 de 4' }).waitFor();
  await mkdir('work', { recursive: true });
  await page.screenshot({ path: 'work/extension-preview.png', fullPage: true });
  assert.equal(await page.locator('.best a').textContent(), 'Bertrand');
  assert.equal(await page.locator('#delivery-settings').count(), 0);
  assert.match(await page.locator('#rate-link').getAttribute('href'), /chromewebstore.google.com/);
  const issue = new URL(await page.locator('#report-link').getAttribute('href'));
  assert.equal(issue.pathname, '/rfsbraz/livros-mais-baratos-pt/issues/new');
  assert.equal(issue.searchParams.get('template'), 'bug_report.yml');
  assert.match(issue.searchParams.get('environment'), /chrome/);
  assert.equal(await page.evaluate(() => window.__data.shipping), undefined);
  await page.locator('#open-settings').click();
  // Selection survives reload, requests only selected origins, and cancellation does not save partial history.
  await page.locator('#shops > summary').click();
  await page.locator('#select-none').click();
  await page.locator('#close-settings').click();
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'pelo menos uma loja' }).waitFor();
  await page.locator('input[value="wook"]').check();
  await page.waitForFunction(() => window.__data.selectedStores.join() === 'wook');
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('#coverage').textContent === 'Lojas: 1 de 26 selecionadas'
  );
  const beforeCancel = await page.evaluate(() => JSON.stringify(window.__data.history));
  let releaseRequest;
  const requestStarted = new Promise(resolve => {
    releaseRequest = resolve;
  });
  await page.route('https://www.wook.pt/**', route => {
    releaseRequest(route);
  });
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  const pending = await requestStarted;
  await page.getByRole('button', { name: 'Parar consulta', exact: true }).click();
  await pending.fulfill({ contentType: 'text/html', body: product('18.00') }).catch(() => {});
  await page.getByRole('status').filter({ hasText: 'Consulta interrompida' }).waitFor();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__data.history)), beforeCancel);
  assert.deepEqual(await page.evaluate(() => window.__requested.origins), [
    'https://www.wook.pt/*'
  ]);
  await page.locator('#open-settings').click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Apagar dados' }).click();
  await page.getByRole('status').filter({ hasText: 'apagados' }).waitFor();
  assert.equal(await page.evaluate(() => Object.keys(window.__data.history).length), 0);
  assert.equal(await page.locator('#count').textContent(), '0');
  assert.deepEqual(errors, []);
  console.log(
    'Browser integration passed: detection, exact ISBN, currency parsing, stock ranking, blocked shop, save/reload, invalid input, permission denial and data deletion. Fixtures are synthetic, not live prices.'
  );
} finally {
  await browser.close();
  server.close();
}
