import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validBatch } from '../../worker/metrics-batch.js';
import {
  mergePoint,
  buildBatch,
  clientBatchSafe,
  latencyBucket,
  outcomeFromStatus,
  storeResultPoint,
  configSnapshotPoints,
  trimPending,
  pendingBytes,
  MAX_PENDING_BYTES,
  defaultMetricsEnabled,
  utcDay
} from '../../metrics.js';

const schema = JSON.parse(readFileSync('metrics-schema.json', 'utf8'));

test('latency buckets match the closed schema list', () => {
  assert.equal(latencyBucket(0), '250');
  assert.equal(latencyBucket(250), '250');
  assert.equal(latencyBucket(251), '500');
  assert.equal(latencyBucket(35000), '35000');
  assert.equal(latencyBucket(35001), 'inf');
  assert.equal(latencyBucket(Infinity), 'inf');
});

test('outcome mapping covers compare statuses', () => {
  assert.equal(outcomeFromStatus('ok'), 'price');
  assert.equal(outcomeFromStatus('unverified'), 'no_price');
  assert.equal(outcomeFromStatus('blocked'), 'blocked');
  assert.equal(outcomeFromStatus('timeout'), 'timeout');
  assert.equal(outcomeFromStatus('cancelled'), 'aborted');
  assert.equal(outcomeFromStatus('cached'), 'cached');
  assert.equal(outcomeFromStatus('disabled'), 'disabled');
});

test('a built batch passes the shared schema validator', () => {
  let pending = { points: {} };
  pending = mergePoint(pending, { metric: 'popup_open', count: 1 });
  pending = mergePoint(pending, {
    metric: 'compare_run',
    surface: 'popup',
    outcome: 'isbn_typed',
    count: 2
  });
  pending = mergePoint(pending, storeResultPoint('popup', 'wook', 'ok', 900));
  pending = mergePoint(pending, storeResultPoint('popup', 'bertrand', 'blocked', 1200));
  pending = mergePoint(pending, storeResultPoint('popup', 'almedina', 'disabled', 0));
  pending = mergePoint(pending, {
    metric: 't_first_result',
    outcome: 'settled',
    bucket: '1000',
    count: 1
  });
  pending = mergePoint(pending, {
    metric: 't_all_settled',
    outcome: 'settled',
    bucket: '3000',
    count: 1
  });
  for (const point of configSnapshotPoints({
    selectedIds: ['wook', 'bertrand'],
    autoEnabled: true,
    wookPromotionEnabled: false,
    affiliateEnabled: true
  })) {
    pending = mergePoint(pending, point);
  }
  const batch = buildBatch(pending, {
    browser: 'chrome',
    version: '0.1.6',
    day: '2026-11-06'
  });
  assert.equal(validBatch(batch, schema), true);
  assert.equal(clientBatchSafe(batch), true);
});

test('rejects points outside the whitelist and never keeps ISBN or http', () => {
  let pending = { points: {} };
  pending = mergePoint(pending, { metric: 'not_a_metric', count: 1 });
  pending = mergePoint(pending, {
    metric: 'store_latency',
    surface: 'popup',
    store: 'not-a-store',
    outcome: 'price',
    bucket: '1000',
    count: 1
  });
  assert.equal(Object.keys(pending.points).length, 0);
  pending = mergePoint(pending, {
    metric: 'store_latency',
    surface: 'popup',
    store: 'wook',
    outcome: 'price',
    bucket: '1000',
    isbn: '9789895701124',
    count: 1
  });
  const batch = buildBatch(pending, { browser: 'chrome', version: '0.1.6', day: utcDay() });
  const text = JSON.stringify(batch);
  assert.equal(/97[89]\d{10}/.test(text), false);
  assert.equal(/https?:/i.test(text), false);
  assert.equal(
    clientBatchSafe({
      ...batch,
      points: [{ metric: 'popup_open', count: 1, title: '9789895701124' }]
    }),
    false
  );
  assert.equal(
    clientBatchSafe({ ...batch, points: [{ metric: 'popup_open', count: 1, note: 'http://x' }] }),
    false
  );
});

test('serialized batch never contains sample title, url, isbn or price inputs', () => {
  const sample = {
    isbn: '9789895701124',
    title: 'Livro de Exemplo',
    url: 'https://www.wook.pt/livro/exemplo',
    price: 1890
  };
  let pending = { points: {} };
  pending = mergePoint(pending, storeResultPoint('popup', 'wook', 'ok', 800));
  pending = mergePoint(pending, {
    metric: 'affiliate_click',
    surface: 'popup_offer',
    count: 1
  });
  const batch = buildBatch(pending, { browser: 'firefox', version: '0.1.6', day: '2026-11-06' });
  const text = JSON.stringify(batch);
  assert.equal(text.includes(sample.isbn), false);
  assert.equal(text.includes(sample.title), false);
  assert.equal(text.includes(sample.url), false);
  assert.equal(text.includes(String(sample.price)), false);
  assert.equal(validBatch(batch, schema), true);
});

test('pending storage respects the 32 KB cap by dropping oldest points', () => {
  let pending = { points: {} };
  for (let i = 0; i < 500; i++) {
    pending = mergePoint(pending, {
      metric: 'store_latency',
      surface: 'popup',
      store: 'wook',
      outcome: 'price',
      bucket: '1000',
      count: 1000
    });
    // vary bucket to create distinct keys
    pending = mergePoint(pending, {
      metric: 'store_latency',
      surface: 'popup',
      store: 'wook',
      outcome: 'price',
      bucket: schema.sets.buckets[i % schema.sets.buckets.length],
      count: 50000
    });
  }
  const trimmed = trimPending(pending, MAX_PENDING_BYTES);
  assert.ok(pendingBytes(trimmed) <= MAX_PENDING_BYTES);
});

test('chrome and edge default metrics on; firefox defaults off', () => {
  assert.equal(defaultMetricsEnabled('chrome'), true);
  assert.equal(defaultMetricsEnabled('edge'), true);
  assert.equal(defaultMetricsEnabled('firefox'), false);
});

test('flush retries three times then drops (offline)', async () => {
  const { flushMetrics, RETRY_KEY, PENDING_KEY } = await import('../../metrics.js');
  const storage = {
    metricsEnabled: true,
    metricsPending: mergePoint({ points: {} }, { metric: 'popup_open', count: 1 }),
    selectedStores: ['wook']
  };
  globalThis.chrome = {
    storage: {
      local: {
        get: async keys => {
          const list = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(list.map(k => [k, storage[k]]));
        },
        set: async patch => {
          Object.assign(storage, patch);
        },
        remove: async keys => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete storage[key];
          }
        }
      }
    },
    alarms: {
      create: async () => {},
      clear: async () => true,
      get: async () => null
    },
    runtime: {
      getManifest: () => ({ version: '0.1.6' })
    }
  };
  const fetchImpl = async () => {
    throw new Error('offline');
  };
  let result;
  for (let i = 0; i < 3; i++) {
    result = await flushMetrics({ now: 1_000_000 + i * 60_000, fetchImpl, force: true });
    assert.equal(result.reason, 'retry');
    assert.ok(storage[RETRY_KEY]);
    // advance past backoff for the next attempt
    storage[RETRY_KEY] = { attempt: result.attempt, nextAt: 0 };
  }
  result = await flushMetrics({ now: 9_000_000_000, fetchImpl, force: true });
  assert.equal(result.reason, 'dropped');
  assert.equal(storage[PENDING_KEY], undefined);
});

test('the endpoint fixture and distributed metric schema cannot drift', () => {
  assert.deepEqual(JSON.parse(readFileSync('tests/fixtures/metrics-schema.json', 'utf8')), schema);
});
