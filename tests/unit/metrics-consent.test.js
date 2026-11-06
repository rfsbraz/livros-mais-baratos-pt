import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { firefoxCollectionAllowed, setMetricsEnabled, recordPoints } from '../../metrics.js';

const originalChrome = globalThis.chrome;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
afterEach(() => {
  globalThis.chrome = originalChrome;
  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
  }
});

function environment({ firefox = true, granted = false, available = true } = {}) {
  const storage = { metricsEnabled: true };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: firefox ? 'Firefox/145.0' : 'Chrome/140.0' }
  });
  globalThis.chrome = {
    permissions: {
      getAll: async () =>
        available ? { data_collection: granted ? ['technicalAndInteraction'] : [] } : {},
      request: async () => granted
    },
    storage: {
      local: {
        get: async () => structuredClone(storage),
        set: async patch => Object.assign(storage, structuredClone(patch)),
        remove: async keys => [].concat(keys).forEach(key => delete storage[key])
      }
    },
    alarms: { create: async () => {}, clear: async () => {}, get: async () => undefined }
  };
  return storage;
}

test('Firefox requires the native optional grant even when the local setting is enabled', async () => {
  const storage = environment();
  assert.equal(await firefoxCollectionAllowed(), false);
  await recordPoints([{ metric: 'popup_open', count: 1 }]);
  assert.equal(storage.metricsPending, undefined);
  assert.equal(await setMetricsEnabled(true), false);
  assert.equal(storage.metricsEnabled, false);
});

test('Firefox reads data_collection from permissions.getAll and fails closed without it', async () => {
  environment({ granted: true });
  assert.equal(await firefoxCollectionAllowed(), true);
  environment({ available: false });
  assert.equal(await firefoxCollectionAllowed(), false);
});

test('only an accepted request enables Firefox metrics; Chrome needs no data permission', async () => {
  const storage = environment({ granted: true });
  let requested;
  chrome.permissions.request = async input => {
    requested = input;
    return true;
  };
  assert.equal(await setMetricsEnabled(true), true);
  assert.deepEqual(requested, { data_collection: ['technicalAndInteraction'] });
  assert.equal(storage.metricsEnabled, true);
  environment({ firefox: false });
  delete chrome.permissions;
  assert.equal(await firefoxCollectionAllowed(), true);
  assert.equal(await setMetricsEnabled(true), true);
});
