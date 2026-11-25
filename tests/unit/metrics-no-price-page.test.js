import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validBatch, dataPoints } from '../../worker/metrics-batch.js';
import { validPoint } from '../../metrics-validation.js';
import { mergePoint, buildBatch, clientBatchSafe, storeResultPoint } from '../../metrics.js';
import { comparisonMetrics } from '../../comparison-metrics.js';
import { compareStore } from '../../compare.js';
import { STORES } from '../../stores.js';

const schema = JSON.parse(readFileSync('metrics-schema.json', 'utf8'));
const almedina = STORES.find(store => store.id === 'almedina');
const SEARCH_ISBN = '9789895701124';
const OTHER_ISBN = '9780306406157';
const PRODUCT_URL = 'https://www.almedina.net/a-criada-1684375304.html';
const SEARCH_URL = almedina.search(SEARCH_ISBN);
const productFixture = readFileSync('tests/fixtures/almedina-no-price-product.html', 'utf8');
const searchFixture = readFileSync('tests/fixtures/almedina-no-price-search.html', 'utf8');

function stubDoc({ url, status }) {
  return {
    shopUrl: url,
    httpStatus: status,
    title: '',
    querySelectorAll: () => [],
    querySelector: () => null
  };
}

function eventText(value) {
  return JSON.stringify(value);
}

function assertNoIdentifiers(
  value,
  urls = [PRODUCT_URL, SEARCH_URL],
  isbns = [SEARCH_ISBN, OTHER_ISBN]
) {
  const text = eventText(value);
  for (const isbn of isbns) {
    assert.equal(text.includes(isbn), false, `event leaked ISBN ${isbn}`);
  }
  for (const url of urls) {
    assert.equal(text.includes(url), false, `event leaked URL ${url}`);
  }
  assert.equal(/https?:/i.test(text), false, 'event leaked an http URL');
  assert.equal(/97[89]\d{10}/.test(text), false, 'event leaked an ISBN');
}

test('fixtures stay trimmed and only contain the public catalog sample', () => {
  assert.match(productFixture, /a-criada-1684375304\.html/);
  assert.match(productFixture, /9789895701124/);
  assert.match(searchFixture, /Resultados de pesquisa/);
  assert.ok(productFixture.length < 4000);
  assert.ok(searchFixture.length < 1000);
  assert.equal(/@gmail\.|@hotmail\./i.test(productFixture + searchFixture), false);
});

test('no_price after a search page records page=search and http_status=200', async () => {
  const result = await compareStore(almedina, SEARCH_ISBN, AbortSignal.timeout(5000), async () =>
    stubDoc({ url: SEARCH_URL, status: 200 })
  );
  assert.equal(result.status, 'unverified');
  assert.equal(result.page, 'search');
  assert.equal(result.http_status, 200);
  const point = storeResultPoint('popup', 'almedina', result.status, 1500, {
    page: result.page,
    http_status: result.http_status
  });
  assert.equal(point.metric, 'store_latency');
  assert.equal(point.outcome, 'no_price');
  assert.equal(point.page, 'search');
  assert.equal(point.http_status, 200);
  assertNoIdentifiers(point);
});

test('no_price after a product page records page=product and http_status=200', async () => {
  const result = await compareStore(almedina, OTHER_ISBN, AbortSignal.timeout(5000), async () =>
    stubDoc({ url: PRODUCT_URL, status: 200 })
  );
  assert.equal(result.status, 'unverified');
  assert.equal(result.page, 'product');
  assert.equal(result.http_status, 200);
  const point = storeResultPoint('auto', 'almedina', result.status, 3000, {
    page: result.page,
    http_status: result.http_status
  });
  assert.equal(point.outcome, 'no_price');
  assert.equal(point.page, 'product');
  assert.equal(point.http_status, 200);
  assertNoIdentifiers(point);
});

test('no_price can record a non-200 HTTP status without a URL or ISBN', () => {
  const point = storeResultPoint('popup', 'almedina', 'unverified', 500, {
    page: 'search',
    http_status: 403
  });
  assert.equal(point.outcome, 'no_price');
  assert.equal(point.page, 'search');
  assert.equal(point.http_status, 403);
  assertNoIdentifiers(point);
});

test('price outcomes do not gain page or http_status', () => {
  const point = storeResultPoint('popup', 'almedina', 'ok', 900, {
    page: 'product',
    http_status: 200
  });
  assert.equal(point.outcome, 'price');
  assert.equal(Object.hasOwn(point, 'page'), false);
  assert.equal(Object.hasOwn(point, 'http_status'), false);
});

test('comparison metrics forward page and http_status only on no_price', async () => {
  const points = [];
  const run = comparisonMetrics({
    stores: ['almedina'],
    surface: 'popup',
    now: () => 10,
    record: async batch => points.push(...batch)
  });
  run.rendered('almedina', 'unverified', { page: 'product', http_status: 200 });
  run.finish();
  const point = points.find(p => p.metric === 'store_latency');
  assert.equal(point.outcome, 'no_price');
  assert.equal(point.page, 'product');
  assert.equal(point.http_status, 200);
  assertNoIdentifiers(points);
});

test('the validator accepts old no_price points and the new optional fields', () => {
  const legacy = {
    metric: 'store_latency',
    surface: 'popup',
    store: 'almedina',
    outcome: 'no_price',
    bucket: '2000',
    count: 1
  };
  const updated = { ...legacy, page: 'search', http_status: 200 };
  assert.equal(validPoint(legacy, schema), true);
  assert.equal(validPoint(updated, schema), true);
  let pending = mergePoint({ points: {} }, legacy);
  pending = mergePoint(pending, updated);
  assert.equal(Object.keys(pending.points).length, 2);
  const batch = buildBatch(pending, {
    browser: 'chrome',
    version: '0.1.10',
    day: '2026-11-25'
  });
  assert.equal(validBatch(batch, schema), true);
  assert.equal(clientBatchSafe(batch), true);
  assertNoIdentifiers(batch);
});

test('the validator rejects identifying or out-of-range no_price fields', () => {
  const base = {
    metric: 'store_latency',
    surface: 'popup',
    store: 'almedina',
    outcome: 'no_price',
    bucket: '2000',
    count: 1
  };
  assert.equal(validPoint({ ...base, url: PRODUCT_URL }, schema), false);
  assert.equal(validPoint({ ...base, isbn: SEARCH_ISBN }, schema), false);
  assert.equal(validPoint({ ...base, page: PRODUCT_URL }, schema), false);
  assert.equal(validPoint({ ...base, page: 'home' }, schema), false);
  assert.equal(validPoint({ ...base, http_status: 99 }, schema), false);
  assert.equal(validPoint({ ...base, http_status: 600 }, schema), false);
  assert.equal(validPoint({ ...base, http_status: 200.5 }, schema), false);
  assert.equal(
    validPoint({ ...base, outcome: 'price', page: 'product', http_status: 200 }, schema),
    false
  );
});

test('Analytics Engine writes page and status after the existing columns', () => {
  const price = {
    metric: 'store_latency',
    surface: 'popup',
    store: 'wook',
    outcome: 'price',
    bucket: '1000',
    count: 3
  };
  const noPrice = {
    metric: 'store_latency',
    surface: 'popup',
    store: 'almedina',
    outcome: 'no_price',
    bucket: '2000',
    page: 'search',
    http_status: 403,
    count: 1
  };
  const [pricePoint] = dataPoints({
    schema: 1,
    browser: 'chrome',
    version: '0.1.10',
    day: '2026-11-25',
    sample_rate: 1,
    points: [price]
  });
  assert.deepEqual(pricePoint.blobs, [
    'store_latency',
    'chrome',
    '0.1.10',
    'popup',
    'wook',
    'price',
    '1000'
  ]);
  assert.deepEqual(pricePoint.doubles, [3, 1, 1000]);
  const [noPricePoint] = dataPoints({
    schema: 1,
    browser: 'chrome',
    version: '0.1.10',
    day: '2026-11-25',
    sample_rate: 1,
    points: [noPrice]
  });
  assert.equal(noPricePoint.blobs[7], 'search');
  assert.equal(noPricePoint.doubles[3], 403);
  assert.deepEqual(noPricePoint.blobs.slice(0, 7), [
    'store_latency',
    'chrome',
    '0.1.10',
    'popup',
    'almedina',
    'no_price',
    '2000'
  ]);
  assertNoIdentifiers(noPricePoint);
});
