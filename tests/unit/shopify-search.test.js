import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shopifyProductLinks, shopifySearchUrl } from '../../shopify-search.js';
import { STORES } from '../../stores.js';
import { compareStore } from '../../compare.js';

const store = STORES.find(s => s.id === 'presenca');
const payload = products => ({ resources: { results: { products } } });

test('pesquisa Shopify limita produtos e inclui SKU e código de barras', () => {
  const endpoint = new URL(shopifySearchUrl(store, store.search('9780306406157')));
  assert.equal(endpoint.origin, store.origin);
  assert.equal(endpoint.pathname, '/search/suggest.json');
  assert.equal(endpoint.searchParams.get('q'), '9780306406157');
  assert.equal(endpoint.searchParams.get('resources[type]'), 'product');
  assert.equal(endpoint.searchParams.get('resources[limit]'), '6');
  assert.equal(
    endpoint.searchParams.get('resources[options][fields]'),
    'title,variants.sku,variants.barcode'
  );
});

test('sugestões aceitam apenas produtos da loja e removem parâmetros de seguimento', () => {
  assert.deepEqual(
    shopifyProductLinks(
      payload([
        { url: '/products/livro?_psq=isbn#detalhes' },
        { url: `${store.origin}/products/livro?_pos=1` },
        { url: 'https://example.org/products/livro' },
        { url: '/cart' },
        { url: 'javascript:alert(1)' },
        null
      ]),
      store
    ),
    [`${store.origin}/products/livro`]
  );
  for (const value of [null, {}, payload(null), payload({})]) {
    assert.deepEqual(shopifyProductLinks(value, store), []);
  }
});

test('sugestões não permitem ultrapassar o limite de candidatos', () => {
  assert.equal(
    shopifyProductLinks(
      payload(Array.from({ length: 100 }, (_, i) => ({ url: `/products/livro-${i}` }))),
      store
    ).length,
    6
  );
});

test('HTTP 429 na pesquisa não provoca pedidos adicionais à loja', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  const result = await compareStore(
    store,
    '9780306406157',
    new AbortController().signal,
    async () => assert.fail('Não deve repetir por HTML depois de HTTP 429')
  );
  assert.equal(result.status, 'blocked');
});
