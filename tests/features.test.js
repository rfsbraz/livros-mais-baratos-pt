import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteDelivery, targetOffer } from '../extension/shipping.js';
import { reduceData } from '../extension/data.js';
import { nextDue, completeWatch } from '../extension/watch.js';
const now = Date.parse('2026-11-03T12:00:00Z');
const offer = { id: 'wook', status: 'ok', price: 1500, currency: 'EUR', condition: 'NewCondition', availability: 'InStock', url: 'https://www.wook.pt/livro/test' };
const settings = { region: 'mainland', rules: { mainland: { wook: { fee: 300, freeFrom: 2000, expiresAt: now + 86400000 } } } };
test('shipping handles unknown, thresholds, regions, expiry and bounded promotions', () => {
  assert.deepEqual([quoteDelivery(offer, settings, now).shipping, quoteDelivery(offer, settings, now).total, quoteDelivery(offer, settings, now).remaining], [300, 1800, 500]);
  assert.equal(quoteDelivery({ ...offer, price: 2000 }, settings, now).shipping, 0);
  assert.equal(quoteDelivery({ ...offer, id: 'bertrand' }, {}, now).total, null);
  assert.equal(quoteDelivery(offer, settings, now + 86400000).total, null);
  assert.equal(quoteDelivery(offer, { ...settings, region: 'other' }, now).total, null);
  assert.equal(quoteDelivery({ ...offer, currency: 'GBP' }, settings, now).total, null);
  assert.equal(quoteDelivery({ ...offer, marketplace: true }, settings, now).total, null);
  const promo = structuredClone(settings);
  promo.rules.mainland.wook.promotion = { verified: true, region: 'mainland', minimum: 1000, startsAt: now - 1, endsAt: now + 1000 };
  assert.equal(quoteDelivery(offer, promo, now).shipping, 0);
  assert.equal(quoteDelivery(offer, promo, now + 1000).shipping, 300);
  promo.rules.mainland.wook.promotion.region = 'madeira';
  assert.equal(quoteDelivery(offer, promo, now).shipping, 300);
  assert.equal(quoteDelivery({ ...offer, id: 'presenca', price: 2000 }, {}, now).total, null, 'ambiguous exact published threshold is not assumed free');
  assert.equal(quoteDelivery({ ...offer, id: 'presenca', price: 2001 }, {}, now).shipping, 0);
});
test('targets compare delivered totals only when known, and require new stock', () => {
  assert.equal(targetOffer([offer], { basis: 'delivered', target: 1700 }, settings, now), null);
  assert.equal(targetOffer([offer], { basis: 'item', target: 1500 }, settings, now).price, 1500);
  assert.equal(targetOffer([offer], { basis: 'delivered', target: 1800 }, settings, now).targetPrice, 1800);
  assert.equal(targetOffer([{ ...offer, id: 'bertrand' }], { basis: 'delivered', target: 5000 }, settings, now), null);
  for (const change of [{ availability: 'OutOfStock' }, { condition: 'UsedCondition' }, { marketplace: true }]) {
    assert.equal(targetOffer([{ ...offer, ...change }], { basis: 'item', target: 5000 }, settings, now), null);
  }
});
const isbn = '9780306406157';
const watched = () => ({ saved: { [isbn]: { isbn, title: 'Teste', watch: { enabled: true, revision: 1, target: 1800, basis: 'delivered', nextCheckAt: 0 } } },
  history: {}, shipping: settings, watchJob: { token: 'job', isbn, revision: 1, at: now, storeIds: ['wook'] } });
test('scheduled observations are local, alerts deduplicate and stale/removed targets are ignored', () => {
  const message = { token: 'job', isbn, offers: [offer] };
  const first = completeWatch(watched(), message, now);
  assert.equal(first.notice.price, 1800);
  assert.equal(first.data.history[isbn][0].source, 'scheduled');
  assert.equal(first.data.saved[isbn].watch.nextCheckAt >= now + 86400000, true);
  const again = { ...first.data, watchJob: watched().watchJob };
  assert.equal(completeWatch(again, message, now + 1).notice, undefined);
  assert.equal(completeWatch(again, { ...message, offers: [{ ...offer, price: 1400 }] }, now + 2).notice.price, 1700);
  assert.equal(completeWatch({ ...watched(), watchEnabled: false }, message, now), null);
  assert.equal(completeWatch({ ...watched(), saved: {} }, message, now), null);
  assert.equal(completeWatch(watched(), { ...message, token: 'stale' }, now), null);
});
test('scheduler survives persisted jobs and spreads overdue work without catch-up bursts', () => {
  const data = watched(); data.watchJob = null;
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
  assert.deepEqual(cleared.history, {}); assert.deepEqual(cleared.saved, {});
  assert.equal(cleared.watchEnabled, false); assert.equal(cleared.watchJob, null);
});

test('concurrent manual and scheduled observations merge without losing shelf preferences', async () => {
  const { writeData } = await import('../extension/data.js');
  let stored = { saved: {}, history: {}, affiliateEnabled: false };
  globalThis.chrome = { storage: { local: {
    get: async () => structuredClone(stored),
    set: async patch => { stored = { ...stored, ...structuredClone(patch) }; }
  } } };
  await Promise.all([
    writeData({ type: 'observe', isbn, offers: [offer], source: 'manual' }),
    writeData({ type: 'save', book: { isbn, title: 'Saved concurrently' } }),
    writeData({ type: 'observe', isbn, offers: [offer], source: 'scheduled' })
  ]);
  assert.equal(stored.history[isbn].length, 2);
  assert.deepEqual(stored.history[isbn].map(p => p.source), ['manual', 'scheduled']);
  assert.equal(stored.saved[isbn].title, 'Saved concurrently');
  assert.equal(stored.affiliateEnabled, false);
  delete globalThis.chrome;
});


test('price cache expires, filters stores, bounds storage and clears with user data', async () => {
  const { cachePrices, cachedPrices, CACHE_MAX_MS, CACHE_FRESH_MS } = await import('../extension/price-cache.js');
  const cache = cachePrices({}, isbn, [offer, { ...offer, id: 'bertrand', url: 'https://evil.test/' }], now, now);
  assert.equal(cachedPrices(cache, isbn, ['wook'], now).offers.length, 1);
  assert.equal(cachedPrices(cache, isbn, ['bertrand'], now), null);
  assert.equal(cachedPrices(cache, isbn, ['wook'], now + CACHE_FRESH_MS).stale, true);
  assert.equal(cachedPrices(cache, isbn, ['wook'], now + CACHE_MAX_MS), null);
  assert.equal(cachedPrices(cache, isbn, ['wook'], now - 1), null);
  assert.deepEqual(cachePrices(cache, isbn, [], now - 1, now), cache);
  let many = {};
  for (let i = 0; i < 60; i++) many = cachePrices(many, String(i), [offer], now + i, now + i);
  assert.equal(Object.keys(many).length, 50);
  assert.deepEqual(reduceData({priceCache: cache}, {type:'clear'}, now).priceCache, {});
});
