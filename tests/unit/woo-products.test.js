import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWooLookup } from '../../woo-products.js';
import { STORES } from '../../stores.js';

const isbn = '9780306406157';
const store = STORES.find(s => s.id === 'devir');
const url = `${store.origin}/livro/exemplo/`;
const signal = new AbortController().signal;
const product = () => ({
  id: 123,
  type: 'simple',
  sku: 'BD770',
  name: 'Exemplo',
  permalink: url,
  prices: { price: '1600', currency_code: 'EUR', currency_minor_unit: 2 },
  is_in_stock: true,
  attributes: [{ name: 'ISBN:', terms: [{ name: isbn }] }]
});

test('Devir confirma ISBN nos atributos e atualiza preço sem carregar HTML', async () => {
  const lookup = createWooLookup();
  const p = product();
  const json = async endpoint => {
    assert.equal(new URL(endpoint).searchParams.get('slug'), 'exemplo');
    return [p];
  };
  const verify = () => assert.fail('Não deve carregar HTML quando a API confirma o ISBN');
  assert.equal((await lookup(store, isbn, url, signal, json, verify)).price, 1600);
  p.prices.price = '1450';
  p.is_in_stock = false;
  const refreshed = await lookup(store, isbn, null, signal, json, verify);
  assert.equal(refreshed.price, 1450);
  assert.equal(refreshed.availability, 'OutOfStock');
});

test('SKU interno exige confirmação inicial e a associação expira após 24 horas', async () => {
  let time = 100;
  const lookup = createWooLookup(() => time);
  const p = { ...product(), attributes: [] };
  let checks = 0;
  const verify = async () => {
    checks++;
    return { url };
  };
  assert.equal((await lookup(store, isbn, url, signal, async () => [p], verify)).price, 1600);
  assert.equal(checks, 1);
  time += 1000;
  await lookup(store, isbn, null, signal, async () => [p], verify);
  assert.equal(checks, 1);
  time += 86400000;
  assert.equal(await lookup(store, isbn, null, signal, async () => [p], verify), null);
  await lookup(store, isbn, url, signal, async () => [p], verify);
  assert.equal(checks, 2);
});

test('não aceita outra edição, outro domínio, preços inválidos ou variantes', async () => {
  const changes = [
    { attributes: [{ name: 'ISBN:', terms: [{ name: '9789895598724' }] }] },
    { sku: '9789895598724' },
    { permalink: 'https://example.org/livro/exemplo/' },
    { permalink: `${store.origin}/livro/outro/` },
    { type: 'variable' },
    { prices: { price: '1600', currency_code: 'USD', currency_minor_unit: 2 } },
    { prices: { price: '-1', currency_code: 'EUR', currency_minor_unit: 2 } }
  ];
  for (const change of changes) {
    assert.equal(
      await createWooLookup()(
        store,
        isbn,
        url,
        signal,
        async () => [{ ...product(), ...change }],
        async () => ({ url })
      ),
      null
    );
  }
});

test('falhas, resultados vazios e ISBN não confirmado permitem alternativa HTML', async () => {
  for (const json of [
    async () => [],
    async () => {
      throw new Error('HTTP 403');
    },
    async () => [{ ...product(), attributes: [] }]
  ]) {
    assert.equal(await createWooLookup()(store, isbn, url, signal, json, async () => null), null);
  }
});

test('uma mudança de produto invalida associação e exige nova confirmação', async () => {
  const lookup = createWooLookup();
  const p = { ...product(), attributes: [] };
  await lookup(
    store,
    isbn,
    url,
    signal,
    async () => [p],
    async () => ({ url })
  );
  p.id = 456;
  assert.equal(await lookup(store, isbn, null, signal, async () => [p]), null);
  p.attributes = [{ name: 'ISBN:', terms: [{ name: '9789895598724' }] }];
  assert.equal(await lookup(store, isbn, null, signal, async () => [p]), null);
  assert.equal(await lookup(store, isbn, null, signal, async () => assert.fail()), null);
});

test('cancelamento não produz oferta nem guarda associação', async () => {
  const controller = new AbortController();
  const lookup = createWooLookup();
  assert.equal(
    await lookup(store, isbn, url, controller.signal, async () => {
      controller.abort();
      return [product()];
    }),
    null
  );
  assert.equal(await lookup(store, isbn, null, signal, async () => assert.fail()), null);
});
