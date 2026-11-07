import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  recordPoints,
  flushMetrics,
  setMetricsEnabled,
  mergePoint,
  buildBatch,
  clientBatchSafe,
  trimPending,
  MAX_PENDING_BYTES,
  installMetrics
} from '../../metrics.js';

const originalChrome = globalThis.chrome;
afterEach(() => {
  globalThis.chrome = originalChrome;
});
const point = { metric: 'popup_open', count: 1 };
const count = storage =>
  Object.values(storage.metricsPending?.points || {}).find(p => p.metric === 'popup_open')?.count ||
  0;

function environment(initial = {}) {
  const storage = { metricsEnabled: true, selectedStores: ['wook'], ...initial };
  const listeners = {};
  globalThis.chrome = {
    runtime: {
      getManifest: () => ({ version: '0.1.6' }),
      getURL: file => `chrome-extension://test/${file}`,
      onMessage: {
        addListener: listener => {
          listeners.message = listener;
        }
      },
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} }
    },
    permissions: {
      onRemoved: {
        addListener: listener => {
          listeners.removed = listener;
        }
      }
    },
    storage: {
      local: {
        get: async () => structuredClone(storage),
        set: async patch => Object.assign(storage, structuredClone(patch)),
        remove: async keys => [].concat(keys).forEach(key => delete storage[key])
      }
    },
    alarms: {
      create: async () => {},
      clear: async () => {},
      get: async () => undefined,
      onAlarm: { addListener() {} }
    }
  };
  return { storage, listeners };
}

test('simultaneous measurements add their counts instead of overwriting each other', async () => {
  const { storage } = environment();
  await Promise.all(Array.from({ length: 20 }, () => recordPoints([{ ...point, count: 3 }])));
  assert.equal(count(storage), 60);
});

test('an upload removes only its snapshot and preserves measurements arriving during fetch', async () => {
  const { storage } = environment();
  await recordPoints([{ ...point, count: 5 }]);
  let finish;
  let started;
  const began = new Promise(resolve => {
    started = resolve;
  });
  const upload = flushMetrics({
    now: 100000,
    fetchImpl: () => {
      started();
      return new Promise(resolve => {
        finish = resolve;
      });
    }
  });
  await began;
  await recordPoints([{ ...point, count: 2 }]);
  finish({ status: 204 });
  assert.equal((await upload).sent, true);
  assert.equal(count(storage), 2);
  let sent = false;
  const result = await flushMetrics({
    now: 100000 + 24 * 60 * 60 * 1000 - 1,
    fetchImpl: async () => {
      sent = true;
      return { status: 204 };
    }
  });
  assert.equal(result.reason, 'rate');
  assert.equal(sent, false);
});

test('opting out aborts an upload and leaves no pending aggregates or retry', async () => {
  const { storage } = environment();
  await recordPoints([point]);
  let started;
  const began = new Promise(resolve => {
    started = resolve;
  });
  let signal;
  const upload = flushMetrics({
    fetchImpl: (_url, options) => {
      signal = options.signal;
      started();
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted')))
      );
    }
  });
  await began;
  await setMetricsEnabled(false);
  await upload;
  assert.equal(signal.aborted, true);
  assert.equal(storage.metricsPending, undefined);
  assert.equal(storage.metricsRetry, undefined);
  await recordPoints([point]);
  assert.equal(storage.metricsPending, undefined);
});

test('the client rejects unknown envelope fields, invalid dimensions and content', () => {
  const batch = buildBatch(mergePoint({ points: {} }, point), {
    browser: 'chrome',
    version: '0.1.6'
  });
  assert.equal(clientBatchSafe(batch), true);
  for (const bad of [
    { ...batch, unknown: 'value' },
    { ...batch, browser: 'other' },
    { ...batch, version: 'https://example.test' },
    { ...batch, points: [{ ...point, title: 'private title' }] },
    { ...batch, points: [{ ...point, count: Infinity }] }
  ]) {
    assert.equal(clientBatchSafe(bad), false);
  }
  const pending = mergePoint({ points: {} }, { ...point, isbn: '9780306406157' });
  assert.deepEqual(Object.values(pending.points), []);
});

test('the actual persisted object stays under 32 KiB and batches fit the receiver limit', () => {
  let pending = { points: {} };
  for (const surface of ['popup', 'auto', 'scheduled']) {
    for (const outcome of ['price', 'error', 'timeout']) {
      for (const bucket of [
        '250',
        '500',
        '1000',
        '1500',
        '2000',
        '3000',
        '5000',
        '8000',
        '12000',
        '20000',
        '35000',
        'inf'
      ]) {
        for (const store of ['wook', 'bertrand', 'almedina']) {
          pending = mergePoint(pending, {
            metric: 'store_latency',
            surface,
            store,
            outcome,
            bucket,
            count: 1
          });
        }
      }
    }
  }
  const batch = buildBatch(pending, { browser: 'chrome', version: '0.1.6' });
  assert.equal(clientBatchSafe(batch), true);
  assert.ok(batch.points.length <= 249);
  const trimmed = trimPending(pending);
  assert.ok(new TextEncoder().encode(JSON.stringify(trimmed)).length <= MAX_PENDING_BYTES);
});

test('separate extension contexts send measurements to the same background writer', async () => {
  const { storage, listeners } = environment();
  chrome.runtime.id = 'test';
  installMetrics();
  chrome.runtime.sendMessage = message =>
    new Promise(resolve => {
      listeners.message(
        message,
        { id: 'test', url: chrome.runtime.getURL('popup.html') + '?isbn=9780306406157' },
        resolve
      );
    });
  const popup = await import('../../metrics.js?popup');
  const content = await import('../../metrics.js?content');
  await Promise.all(
    Array.from({ length: 10 }, () =>
      Promise.all([popup.recordPoints([point]), content.recordPoints([point])])
    )
  );
  assert.equal(count(storage), 20);
  assert.equal(await popup.setMetricsEnabled(false), false);
  assert.equal(storage.metricsPending, undefined);
  const reply = listeners.message(
    { target: 'background', type: 'metrics', action: 'enable', enabled: false },
    { id: 'other', url: chrome.runtime.getURL('popup.html') },
    () => assert.fail('untrusted sender')
  );
  assert.equal(reply, undefined);
});
