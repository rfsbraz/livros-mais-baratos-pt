import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as metrics from '../../metrics.js';
import { migrateData, writeData } from '../../data.js';

const originalChrome = globalThis.chrome;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
afterEach(() => {
  globalThis.chrome = originalChrome;
  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
  }
});

function environment(initial = {}, { browser = 'chrome', granted = true } = {}) {
  const storage = structuredClone(initial);
  const writes = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      userAgent: {
        chrome: 'Chrome/140.0',
        edge: 'Chrome/140.0 Edg/140.0',
        firefox: 'Firefox/145.0'
      }[browser]
    }
  });
  globalThis.chrome = {
    permissions: {
      getAll: async () => ({ data_collection: granted ? ['technicalAndInteraction'] : [] }),
      request: async () => granted
    },
    storage: {
      local: {
        get: async keys => {
          const all = structuredClone(storage);
          if (keys == null) {
            return all;
          }
          return Object.fromEntries(
            []
              .concat(keys)
              .filter(k => k in all)
              .map(k => [k, all[k]])
          );
        },
        set: async patch => {
          writes.push(structuredClone(patch));
          Object.assign(storage, structuredClone(patch));
        },
        remove: async keys => [].concat(keys).forEach(key => delete storage[key])
      }
    },
    alarms: { create: async () => {}, clear: async () => {}, get: async () => undefined }
  };
  return { storage, writes };
}

const pendingCount = storage => Object.keys(storage.metricsPending?.points || {}).length;

for (const browser of ['chrome', 'edge', 'firefox']) {
  test(`fresh ${browser} install has anonymous statistics on`, async () => {
    const { storage } = environment({}, { browser });
    assert.equal(metrics.defaultMetricsEnabled(browser), true);
    assert.equal((await metrics.readMetricsState()).enabled, true);
    await metrics.recordPoints([{ metric: 'popup_open', count: 1 }]);
    assert.equal(pendingCount(storage), 1);
  });
}

test('fresh Firefox install without the native grant still collects nothing', async () => {
  const { storage } = environment({}, { browser: 'firefox', granted: false });
  await metrics.recordPoints([{ metric: 'popup_open', count: 1 }]);
  assert.equal(pendingCount(storage), 0);
});

test('migration: never touched stays unmarked and resolves to on', () => {
  const next = migrateData({ saved: {} });
  assert.equal(next.metricsChoice, undefined);
  assert.equal(metrics.metricsEnabledFrom?.(next), true);
});

test('migration: an explicit opt-out is marked and stays off', () => {
  const next = migrateData({ metricsEnabled: false });
  assert.equal(next.metricsChoice, 'off');
  assert.equal(next.metricsEnabled, false);
  assert.equal(metrics.metricsEnabledFrom?.(next), false);
  assert.equal(migrateData({ metricsEnabled: true }).metricsChoice, 'on');
});

test('migration: a recorded choice is never overwritten and re-running is a no-op', async () => {
  assert.equal(migrateData({ metricsChoice: 'on', metricsEnabled: false }).metricsChoice, 'on');
  const once = migrateData({ metricsEnabled: false, saved: {} });
  assert.deepEqual(migrateData(once), once);

  const { storage, writes } = environment({ metricsEnabled: false });
  await writeData({ type: 'migrate' });
  assert.equal(storage.metricsChoice, 'off');
  const before = writes.length;
  await writeData({ type: 'migrate' });
  assert.equal(
    writes.some((w, i) => i >= before && 'metricsChoice' in w),
    false
  );
  assert.equal(storage.metricsChoice, 'off');
});

test('an explicit opt-out survives on Firefox even with the native grant present', async () => {
  const { storage } = environment({ metricsEnabled: false }, { browser: 'firefox' });
  assert.equal((await metrics.readMetricsState()).enabled, false);
  await metrics.recordPoints([{ metric: 'popup_open', count: 1 }]);
  assert.equal(pendingCount(storage), 0);
});

test('the toggle works both ways and records the explicit choice', async () => {
  const { storage } = environment({});
  await metrics.recordPoints([{ metric: 'popup_open', count: 1 }]);
  assert.equal(await metrics.setMetricsEnabled(false), false);
  assert.equal(storage.metricsEnabled, false);
  assert.equal(storage.metricsChoice, 'off');
  assert.equal(pendingCount(storage), 0);
  assert.equal((await metrics.readMetricsState()).enabled, false);

  assert.equal(await metrics.setMetricsEnabled(true), true);
  assert.equal(storage.metricsEnabled, true);
  assert.equal(storage.metricsChoice, 'on');
  assert.equal((await metrics.readMetricsState()).enabled, true);
});

test('the popup toggle reflects the stored choice and the Firefox grant', async () => {
  assert.equal(typeof metrics.metricsCollectionActive, 'function');
  environment({});
  assert.equal(await metrics.metricsCollectionActive(), true);
  environment({ metricsChoice: 'off', metricsEnabled: false });
  assert.equal(await metrics.metricsCollectionActive(), false);
  environment({}, { browser: 'firefox', granted: false });
  assert.equal(await metrics.metricsCollectionActive(), false);
  environment({}, { browser: 'firefox', granted: true });
  assert.equal(await metrics.metricsCollectionActive(), true);
});
