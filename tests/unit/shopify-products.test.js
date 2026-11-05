import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShopifyLookup } from '../../shopify-products.js';
import { STORES } from '../../stores.js';
const store = STORES.find(s => s.id === 'presenca');
const isbn = '9780306406157';
const url = store.origin + '/products/livro';
const signal = new AbortController().signal;
const product = () => ({
  id: 1,
  handle: 'livro',
  title: 'Livro',
  variants: [{ id: 2, sku: isbn, barcode: isbn, price: 1800, available: true }]
});
const loader =
  (p, currency = 'EUR') =>
  async endpoint =>
    endpoint.endsWith('/cart.js') ? { currency } : p;

test('Shopify usa o preço e stock da variante com ISBN exato', async () => {
  const p = product();
  p.variants.unshift({ id: 3, sku: '9789895598724', price: 10, available: true });
  const lookup = createShopifyLookup();
  const first = await lookup(store, isbn, url, signal, loader(p), () => assert.fail());
  assert.equal(first.price, 1800);
  assert.equal(new URL(first.url).searchParams.get('variant'), '2');
  p.variants[1].price = 1500;
  p.variants[1].available = false;
  const second = await lookup(store, isbn, null, signal, loader(p), () => assert.fail());
  assert.equal(second.price, 1500);
  assert.equal(second.availability, 'OutOfStock');
});

test('SKU sem ISBN exige confirmação da página e associação expira', async () => {
  let now = 0,
    confirmations = 0;
  const lookup = createShopifyLookup(() => now);
  const p = product();
  p.variants[0].sku = 'Descrição interna';
  p.variants[0].barcode = null;
  const verify = async () => {
    confirmations++;
    return { url };
  };
  assert.equal((await lookup(store, isbn, url, signal, loader(p), verify)).price, 1800);
  await lookup(store, isbn, null, signal, loader(p), verify);
  assert.equal(confirmations, 1);
  now = 86400001;
  assert.equal(await lookup(store, isbn, null, signal, loader(p), verify), null);
  await lookup(store, isbn, url, signal, loader(p), verify);
  assert.equal(confirmations, 2);
  p.variants[0].id = 4;
  assert.equal(await lookup(store, isbn, null, signal, loader(p)), null);
});

test('Shopify rejeita outra moeda, edição ambígua, identificadores contraditórios e preços inválidos', async () => {
  assert.equal(
    await createShopifyLookup()(store, isbn, url, signal, loader(product(), 'USD')),
    null
  );
  for (const edit of [
    p => (p.variants[0].barcode = '9789895598724'),
    p => p.variants.push({ ...p.variants[0], id: 3 }),
    p => (p.variants[0].price = -1),
    p => (p.variants[0].price = 10.5),
    p => (p.handle = 'outro'),
    p => (p.variants = null),
    p =>
      (p.variants = [
        { id: 2, sku: 'internal', price: 1800 },
        { id: 3, sku: 'other', price: 1000 }
      ])
  ]) {
    const p = product();
    edit(p);
    assert.equal(
      await createShopifyLookup()(store, isbn, url, signal, loader(p), async () => ({ url })),
      null
    );
  }
});

test('não consulta destinos externos nem aceita confirmação de outra página', async () => {
  const lookup = createShopifyLookup();
  assert.equal(
    await lookup(store, isbn, 'https://example.org/products/livro', signal, () => assert.fail()),
    null
  );
  const p = product();
  p.variants[0].sku = '';
  p.variants[0].barcode = null;
  assert.equal(
    await lookup(store, isbn, url, signal, loader(p), async () => ({
      url: store.origin + '/products/outro'
    })),
    null
  );
});

test('erros transitórios permitem alternativa, bloqueios e cancelamentos interrompem pedidos', async () => {
  const lookup = createShopifyLookup();
  assert.equal(
    await lookup(store, isbn, url, signal, async () => {
      throw new Error('HTTP 503');
    }),
    null
  );
  await assert.rejects(
    lookup(store, isbn, url, signal, async () => {
      throw new Error('HTTP 429');
    }),
    /429/
  );
  const controller = new AbortController();
  await assert.rejects(
    lookup(store, isbn, url, controller.signal, async endpoint => {
      if (endpoint.endsWith('/cart.js')) {
        controller.abort();
        return { currency: 'EUR' };
      }
      return product();
    })
  );
  assert.equal(await lookup(store, isbn, null, signal, () => assert.fail()), null);
});
