import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isbn13, euros, identity, offerFrom, safeUrl, remember, wooOffer } from '../extension/core.js';
test('normalizes ISBN-10 and ISBN-13, including X check digit', () => {
  assert.equal(isbn13('978-0-306-40615-7'), '9780306406157');
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
  for (const value of ['', null, '-5', '20% desconto', '10-20', '12.999', 0, Infinity]) assert.equal(euros(value), null);
});
test('restricts merchant URLs to the expected HTTPS origin', () => {
  assert.equal(safeUrl('/livro/teste', 'https://www.wook.pt'), 'https://www.wook.pt/livro/teste');
  for (const url of ['https://evil.test/', '//evil.test', 'javascript:alert(1)', 'http://www.wook.pt', 'https://a:b@www.wook.pt/']) assert.equal(safeUrl(url, 'https://www.wook.pt'), null);
});
test('extracts only explicit EUR offers and preserves stock state', () => {
  const book = { name: 'Example', isbn: '0306406152', offers: { price: '15.45', priceCurrency: 'EUR', availability: 'https://schema.org/OutOfStock', url: '/livro/example' } };
  assert.equal(identity(book), '9780306406157');
  const offer = offerFrom(book, 'https://www.wook.pt');
  assert.equal(offer.price, 1545); assert.equal(offer.availability, 'OutOfStock');
  assert.equal(offerFrom({ offers: { lowPrice: 10, priceCurrency: 'EUR' } }, 'https://www.wook.pt'), null);
  assert.equal(offerFrom({ offers: { price: 10, priceCurrency: 'USD' } }, 'https://www.wook.pt'), null);
});
test('history excludes failed offers, expires old observations and bounds storage', () => {
  const now = 1800000000000;
  const initial = { a: [{ store: 'wook', price: 1000, at: now - 91 * 86400000 }] };
  const next = remember(initial, 'a', [{ id: 'wook', price: 900, status: 'ok' }, { id: 'bertrand', status: 'unavailable' }], now);
  assert.equal(next.a.length, 1); assert.equal(next.a[0].price, 900);
  assert.equal(initial.a[0].price, 1000);
  const many = Object.fromEntries(Array.from({ length: 250 }, (_, i) => [String(i), [{ at: now - i }]]));
  assert.equal(Object.keys(remember(many, 'new', [], now)).length, 200);
});
test('WooCommerce matches the ISBN SKU, currency and minor units without using parent IDs', () => {
  const product = { id: 9776, sku: '9789899267411', type: 'simple', name: 'As três da manhã', permalink: 'https://bookcover.pt/product/as-tres-da-manha/', prices: { price: '1800', currency_code: 'EUR', currency_minor_unit: 2 }, is_in_stock: true };
  assert.equal(wooOffer([product], '9789899267411', 'https://bookcover.pt').price, 1800);
  assert.equal(wooOffer([product], '9780306406157', 'https://bookcover.pt'), null);
  assert.equal(wooOffer([{ ...product, prices: { ...product.prices, currency_minor_unit: 0 } }], product.sku, 'https://bookcover.pt'), null);
  assert.equal(wooOffer([{ ...product, permalink: 'https://evil.test/' }], product.sku, 'https://bookcover.pt'), null);
});
