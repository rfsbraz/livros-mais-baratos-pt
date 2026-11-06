import { test } from 'node:test';
import assert from 'node:assert/strict';
import { targetOffer } from '../../offers.js';
import { reduceData, migrateData } from '../../data.js';
import { nextDue, completeWatch } from '../../watch.js';
const now = Date.parse('2026-11-03T12:00:00Z');
const offer = {
  id: 'wook',
  status: 'ok',
  price: 1500,
  currency: 'EUR',
  condition: 'NewCondition',
  availability: 'InStock',
  url: 'https://www.wook.pt/livro/test'
};
test('targets use book prices and require eligible stock', () => {
  assert.equal(targetOffer([offer], { target: 1499 }), null);
  assert.equal(targetOffer([offer], { target: 1500 }).targetPrice, 1500);
  for (const change of [
    { availability: 'OutOfStock' },
    { condition: 'UsedCondition' },
    { marketplace: true },
    { currency: 'GBP' }
  ]) {
    assert.equal(targetOffer([{ ...offer, ...change }], { target: 5000 }), null);
  }
});
const isbn = '9780306406157';
const watched = () => ({
  saved: {
    [isbn]: {
      isbn,
      title: 'Teste',
      watch: { enabled: true, revision: 1, target: 1800, basis: 'item', nextCheckAt: 0 }
    }
  },
  history: {},
  watchJob: { token: 'job', isbn, revision: 1, at: now, storeIds: ['wook'] }
});
test('scheduled observations are local, alerts deduplicate and stale/removed targets are ignored', () => {
  const message = { token: 'job', isbn, offers: [offer] };
  const first = completeWatch(watched(), message, now);
  assert.equal(first.notice.price, 1500);
  assert.equal(first.data.history[isbn][0].source, 'scheduled');
  assert.equal(first.data.saved[isbn].watch.nextCheckAt >= now + 86400000, true);
  const again = { ...first.data, watchJob: watched().watchJob };
  assert.equal(completeWatch(again, message, now + 1).notice, undefined);
  assert.equal(
    completeWatch(again, { ...message, offers: [{ ...offer, price: 1400 }] }, now + 2).notice.price,
    1400
  );
  assert.equal(completeWatch({ ...watched(), watchEnabled: false }, message, now), null);
  assert.equal(completeWatch({ ...watched(), saved: {} }, message, now), null);
  assert.equal(completeWatch(watched(), { ...message, token: 'stale' }, now), null);
});
test('scheduler survives persisted jobs and spreads overdue work without catch-up bursts', () => {
  const data = watched();
  data.watchJob = null;
  assert.equal(nextDue(data, now).isbn, isbn);
  assert.equal(nextDue({ ...data, watchLastStart: now - 1000 }, now), null);
  assert.equal(nextDue(watched(), now), null);
  assert.equal(nextDue(watched(), now + 180001).isbn, isbn);
  assert.equal(nextDue({ ...data, watchEnabled: false }, now), null);
});
test('data mutations preserve targets and observations; clear invalidates in-flight jobs', () => {
  const data = watched();
  const renamed = reduceData(data, { type: 'save', book: { isbn, title: 'New title' } }, now);
  assert.deepEqual(renamed.saved[isbn].watch, data.saved[isbn].watch);
  const observed = reduceData(renamed, { type: 'observe', isbn, offers: [offer] }, now);
  assert.equal(observed.history[isbn][0].source, 'manual');
  const removed = reduceData(observed, { type: 'remove', isbn }, now);
  assert.equal(removed.watchJob, null);
  const cleared = reduceData(observed, { type: 'clear' }, now);
  assert.deepEqual(cleared.history, {});
  assert.deepEqual(cleared.saved, {});
  assert.equal(cleared.watchEnabled, false);
  assert.equal(cleared.watchJob, null);
});

test('incremental observations preserve confirmed prices when a comparison stops early', () => {
  const first = reduceData({}, { type: 'observe-incremental', isbn, offer, source: 'manual' }, now);
  const cheaper = { ...offer, price: 1400 };
  const second = reduceData(
    first,
    { type: 'observe-incremental', isbn, offer: cheaper, source: 'manual' },
    now + 1
  );
  assert.equal(second.history[isbn].length, 2);
  assert.equal(second.priceCache[isbn].offers.length, 1);
  assert.equal(second.priceCache[isbn].offers[0].price, 1400);
  assert.deepEqual(
    reduceData(second, {
      type: 'observe-incremental',
      isbn,
      offer: { ...offer, status: 'loading' }
    }),
    second
  );
  const outOfStock = {
    ...offer,
    id: 'bookcover',
    availability: 'OutOfStock',
    url: 'https://bookcover.pt/product/test/'
  };
  const withStock = reduceData(
    second,
    { type: 'observe-incremental', isbn, offer: outOfStock, source: 'manual' },
    now + 2
  );
  assert.equal(withStock.priceCache[isbn].offers.length, 2);
  assert.equal(
    withStock.priceCache[isbn].offers.find(o => o.id === 'bookcover').availability,
    'OutOfStock'
  );
});

test('concurrent manual and scheduled observations merge without losing shelf preferences', async () => {
  const { writeData } = await import('../../data.js');
  let stored = { saved: {}, history: {}, affiliateEnabled: false };
  globalThis.chrome = {
    storage: {
      local: {
        get: async () => structuredClone(stored),
        set: async patch => {
          stored = { ...stored, ...structuredClone(patch) };
        }
      }
    }
  };
  await Promise.all([
    writeData({ type: 'observe', isbn, offers: [offer], source: 'manual' }),
    writeData({ type: 'save', book: { isbn, title: 'Saved concurrently' } }),
    writeData({ type: 'observe', isbn, offers: [offer], source: 'scheduled' })
  ]);
  assert.equal(stored.history[isbn].length, 2);
  assert.deepEqual(
    stored.history[isbn].map(p => p.source),
    ['manual', 'scheduled']
  );
  assert.equal(stored.saved[isbn].title, 'Saved concurrently');
  assert.equal(stored.affiliateEnabled, false);
  delete globalThis.chrome;
});

test('price cache expires, filters stores, bounds storage and clears with user data', async () => {
  const { cachePrices, cachedPrices, CACHE_MAX_MS, CACHE_FRESH_MS } =
    await import('../../price-cache.js');
  const cache = cachePrices(
    {},
    isbn,
    [offer, { ...offer, id: 'bertrand', url: 'https://evil.test/' }],
    now,
    now
  );
  assert.equal(cachedPrices(cache, isbn, ['wook'], now).offers.length, 1);
  assert.equal(cachedPrices(cache, isbn, ['bertrand'], now), null);
  assert.equal(cachedPrices(cache, isbn, ['wook'], now + CACHE_FRESH_MS).stale, true);
  assert.equal(cachedPrices(cache, isbn, ['wook'], now + CACHE_MAX_MS), null);
  assert.equal(cachedPrices(cache, isbn, ['wook'], now - 1), null);
  assert.deepEqual(cachePrices(cache, isbn, [], now - 1, now), cache);
  let many = {};
  for (let i = 0; i < 60; i++) {
    many = cachePrices(many, String(i), [offer], now + i, now + i);
  }
  assert.equal(Object.keys(many).length, 50);
  assert.deepEqual(reduceData({ priceCache: cache }, { type: 'clear' }, now).priceCache, {});
});

test('default selection contains six automatic stores and preserves explicit preferences', async () => {
  const { STORES, DEFAULT_STORE_IDS, selectedStoreIds } = await import('../../stores.js');
  assert.equal(DEFAULT_STORE_IDS.length, 6);
  assert(DEFAULT_STORE_IDS.every(id => STORES.some(s => s.id === id)));
  assert.deepEqual(selectedStoreIds(undefined), [...DEFAULT_STORE_IDS]);
  assert.deepEqual(selectedStoreIds([]), []);
  assert.deepEqual(selectedStoreIds(['bookcover', 'wook']), ['bookcover', 'wook']);
  assert.deepEqual(reduceData({}, { type: 'clear' }).selectedStores, [...DEFAULT_STORE_IDS]);
});

test('migration removes old delivery rules and resets only delivered targets', () => {
  const old = watched();
  old.saved[isbn].watch.basis = 'delivered';
  old.saved[isbn].watch.lastNotifiedPrice = 1800;
  old.shipping = { region: 'mainland' };
  old.priceOrder = 'delivered';
  old.watchNotices = [
    { isbn, basis: 'delivered' },
    { isbn: 'other', basis: 'item' }
  ];
  const result = migrateData(old);
  assert.equal(result.saved[isbn].watch.target, 1800);
  assert.equal(result.saved[isbn].watch.basis, 'item');
  assert.equal(result.saved[isbn].watch.revision, 2);
  assert.equal(result.saved[isbn].watch.lastNotifiedPrice, undefined);
  assert.equal(result.watchJob, null);
  assert.equal(result.shipping, undefined);
  assert.equal(result.priceOrder, undefined);
  assert.equal(result.watchNotices.length, 1);
  assert.deepEqual(result.history, old.history);
  assert.deepEqual(migrateData(result), result);
  assert.equal(old.saved[isbn].watch.basis, 'delivered');
});

test('new watch writes accept only the item price basis', () => {
  const data = watched();
  const action = { type: 'watch', isbn, target: 1700, enabled: true };
  assert.throws(
    () => reduceData(data, { ...action, basis: 'delivered' }),
    /Tipo de preço inválido/
  );
  assert.throws(() => reduceData(data, action), /Tipo de preço inválido/);
  assert.equal(reduceData(data, { ...action, basis: 'item' }).saved[isbn].watch.basis, 'item');
});
