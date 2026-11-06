import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isbn13,
  euros,
  identity,
  offerFrom,
  safeUrl,
  remember,
  wooOffer,
  svelteProductLinks
} from '../../core.js';
import { pooled, compareStore } from '../../compare.js';
import { STORES, searchUrl } from '../../stores.js';
import { validCurrent, cheaperOffer } from '../../auto-rules.js';

test('automatic alerts require a product page and a cheaper in-stock new offer in the same currency', () => {
  const current = {
    isbn: '9780306406157',
    price: 2000,
    currency: 'EUR',
    condition: 'NewCondition',
    url: 'https://www.wook.pt/livro/teste'
  };
  assert(validCurrent(current, current.url));
  assert(!validCurrent(current, 'https://www.wook.pt/pesquisa'));
  assert(!validCurrent({ ...current, url: 'https://www.wook.pt/livro/other' }, current.url));
  assert(!validCurrent({ ...current, condition: 'UsedCondition' }, current.url));
  const offer = {
    id: 'bertrand',
    origin: 'https://www.bertrand.pt',
    status: 'ok',
    price: 1800,
    currency: 'EUR',
    condition: 'NewCondition',
    availability: 'InStock',
    url: 'https://www.bertrand.pt/livro/teste'
  };
  assert.equal(cheaperOffer(current, [offer], 'wook'), offer);
  for (const change of [
    { price: 2000 },
    { price: 2100 },
    { availability: 'OutOfStock' },
    { availability: '' },
    { condition: 'UsedCondition' },
    { currency: 'GBP' },
    { marketplace: true },
    { status: 'unverified' },
    { url: 'https://evil.test/' },
    { id: 'wook' }
  ]) {
    assert.equal(cheaperOffer(current, [{ ...offer, ...change }], 'wook'), null);
  }
});
test('normalizes ISBN-10 and ISBN-13, including X check digit', () => {
  assert.equal(isbn13('978-0-306-40615-7'), '9780306406157');
  assert.equal(isbn13('978‑972‑608‑449-5'), '9789726084495');
  assert.equal(isbn13('0-306-40615-2'), '9780306406157');
  assert.equal(isbn13('080442957X'), '9780804429573');
  assert.equal(isbn13('9780306406158'), null);
  assert.equal(isbn13('1234567890128'), null);
  assert.equal(isbn13('javascript:alert(1)'), null);
  assert.equal(isbn13('0306406153'), null);
});
test('parses EUR into integer cents without silently interpreting ranges or discounts', () => {
  assert.equal(euros('1.234,56 €'), 123456);
  assert.equal(euros('19,90'), 1990);
  assert.equal(euros('19.90'), 1990);
  assert.equal(euros(19.9), 1990);
  for (const value of ['', null, '-5', '20% desconto', '10-20', '12.999', 0, Infinity]) {
    assert.equal(euros(value), null);
  }
});
test('restricts merchant URLs to the expected HTTPS origin', () => {
  assert.equal(safeUrl('/livro/teste', 'https://www.wook.pt'), 'https://www.wook.pt/livro/teste');
  for (const url of [
    'https://evil.test/',
    '//evil.test',
    'javascript:alert(1)',
    'http://www.wook.pt',
    'https://a:b@www.wook.pt/'
  ]) {
    assert.equal(safeUrl(url, 'https://www.wook.pt'), null);
  }
  for (const url of [
    '/livro/teste?add-to-cart=123',
    '/livro/teste?add_to_wishlist=123',
    '/livro/teste?wc-ajax=add_to_cart',
    '/livro/teste?remove_item=abc'
  ]) {
    assert.equal(safeUrl(url, 'https://www.wook.pt'), null);
  }
});

test('currencies and conditions remain separate in offers and history', () => {
  const offer = offerFrom(
    {
      offers: {
        price: '9.99',
        priceCurrency: 'GBP',
        itemCondition: 'https://schema.org/UsedCondition',
        url: {}
      }
    },
    'https://www.waterstones.com/book/example',
    ['GBP']
  );
  assert.equal(offer.currency, 'GBP');
  assert.equal(offer.condition, 'UsedCondition');
  assert.equal(offer.price, 999);
  assert.equal(offer.url, 'https://www.waterstones.com/book/example');
  const history = remember({}, 'book', [{ ...offer, id: 'waterstones', status: 'ok' }]);
  assert.equal(history.book[0].currency, 'GBP');
  assert.equal(history.book[0].condition, 'UsedCondition');
});

test('Svelte search extracts bounded product links, never trusts search prices or unsafe SKUs', () => {
  const data = [
    { products: 1 },
    { data: 2 },
    [3, 5, 7],
    { sku: 4 },
    '056086',
    { sku: 6 },
    '../cart?add-to-cart=1',
    { sku: 8 },
    '101203'
  ];
  assert.deepEqual(
    svelteProductLinks(
      { nodes: [{ type: 'skip' }, { type: 'data', data }] },
      'https://mundofantasma.com'
    ),
    ['https://mundofantasma.com/produto/056086', 'https://mundofantasma.com/produto/101203']
  );
  for (const payload of [
    null,
    {},
    { nodes: [] },
    { nodes: [{ type: 'data', data: [{ products: -1 }] }] }
  ]) {
    assert.deepEqual(svelteProductLinks(payload, 'https://mundofantasma.com'), []);
  }
});

test('pool bounds active requests and preserves result order', async () => {
  let active = 0,
    peak = 0;
  const result = await pooled(
    [5, 1, 3, 2, 4, 6],
    async n => {
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, n));
      active--;
      return n * 2;
    },
    2
  );
  assert.equal(peak, 2);
  assert.deepEqual(result, [10, 2, 6, 4, 8, 12]);
  assert.deepEqual(await pooled([], () => assert.fail()), []);
});

test('cancelled stores do not start requests and search text cannot inject query parameters', async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await compareStore(STORES[0], '9780306406157', controller.signal, () =>
    assert.fail('Cancelled request started')
  );
  assert.equal(result.status, 'cancelled');
  const store = STORES.find(s => s.id === 'guerraepaz');
  const url = new URL(searchUrl(store, 'Livros & post_type=other / ação', true));
  assert.equal(url.searchParams.get('s'), 'Livros & post_type=other / ação');
  assert.equal(url.searchParams.get('post_type'), 'product');
});
test('extracts only explicit EUR offers and preserves stock state', () => {
  const book = {
    name: 'Example',
    isbn: '0306406152',
    offers: {
      price: '15.45',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/OutOfStock',
      url: '/livro/example'
    }
  };
  assert.equal(identity(book), '9780306406157');
  const offer = offerFrom(book, 'https://www.wook.pt');
  assert.equal(offer.price, 1545);
  assert.equal(offer.availability, 'OutOfStock');
  assert.equal(
    offerFrom({ offers: { lowPrice: 10, priceCurrency: 'EUR' } }, 'https://www.wook.pt'),
    null
  );
  assert.equal(
    offerFrom({ offers: { price: 10, priceCurrency: 'USD' } }, 'https://www.wook.pt'),
    null
  );
});
test('history excludes failed offers, expires old observations and bounds storage', () => {
  const now = 1800000000000;
  const initial = { a: [{ store: 'wook', price: 1000, at: now - 91 * 86400000 }] };
  const next = remember(
    initial,
    'a',
    [
      { id: 'wook', price: 900, status: 'ok' },
      { id: 'bertrand', status: 'unavailable' }
    ],
    now
  );
  assert.equal(next.a.length, 1);
  assert.equal(next.a[0].price, 900);
  assert.equal(initial.a[0].price, 1000);
  const many = Object.fromEntries(
    Array.from({ length: 250 }, (_, i) => [String(i), [{ at: now - i }]])
  );
  assert.equal(Object.keys(remember(many, 'new', [], now)).length, 200);
});
test('WooCommerce matches the ISBN SKU, currency and minor units without using parent IDs', () => {
  const product = {
    id: 9776,
    sku: '9789899267411',
    type: 'simple',
    name: 'As três da manhã',
    permalink: 'https://bookcover.pt/product/as-tres-da-manha/',
    prices: { price: '1800', currency_code: 'EUR', currency_minor_unit: 2 },
    is_in_stock: true
  };
  assert.equal(wooOffer([product], '9789899267411', 'https://bookcover.pt').price, 1800);
  assert.equal(wooOffer([product], '9780306406157', 'https://bookcover.pt'), null);
  assert.equal(
    wooOffer(
      [{ ...product, prices: { ...product.prices, currency_minor_unit: 0 } }],
      product.sku,
      'https://bookcover.pt'
    ),
    null
  );
  assert.equal(
    wooOffer(
      [{ ...product, permalink: 'https://evil.test/' }],
      product.sku,
      'https://bookcover.pt'
    ),
    null
  );
});

test('affiliate destinations follow the preference, preserve attribution and exact HTTPS host', async () => {
  const { affiliateUrl } = await import('../../affiliate.js');
  const raw = 'https://www.wook.pt/livro/exemplo/123?x=1#details';
  assert.equal(
    affiliateUrl(raw, true),
    'https://www.wook.pt/livro/exemplo/123?x=1&a_aid=5d3ee4327c2fd#details'
  );
  assert.equal(affiliateUrl(raw, false), raw);
  for (const url of [
    'https://www.wook.pt/livro/x?a_aid=existing',
    'https://www.wook.pt.evil.test/x',
    'http://www.wook.pt/x',
    'https://user@www.wook.pt/x',
    'https://www.wook.pt:8443/x',
    'https://www.bertrand.pt/livro/x',
    'javascript:alert(1)',
    'invalid'
  ]) {
    assert.equal(affiliateUrl(url, true), url);
  }
});
