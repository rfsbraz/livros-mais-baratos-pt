import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBookAlertsSync } from '../../book-alerts-sync.js';

function mockChrome({ origins = [], registered = [] } = {}) {
  let grantOrigins = origins;
  let scripts = registered.map(matches => ({
    id: 'book-alerts',
    matches
  }));
  const alarms = [];
  const tabs = [{ id: 1, url: 'https://www.wook.pt/livro/o-jantar-freida-mcfadden/33978897' }];
  globalThis.chrome = {
    storage: {
      local: {
        get: async () => ({})
      }
    },
    permissions: {
      getAll: async () => ({ origins: grantOrigins, permissions: [] })
    },
    scripting: {
      getRegisteredContentScripts: async () => scripts.map(s => ({ ...s })),
      unregisterContentScripts: async () => {
        scripts = [];
      },
      registerContentScripts: async ([entry]) => {
        scripts = [{ id: entry.id, matches: entry.matches }];
      },
      executeScript: async () => [{ result: null }]
    },
    tabs: {
      query: async filter => {
        if (!filter?.url) {
          return tabs;
        }
        const patterns = Array.isArray(filter.url) ? filter.url : [filter.url];
        return tabs.filter(tab => patterns.some(p => tab.url.startsWith(p.replace(/\/\*$/, '/'))));
      },
      sendMessage: async () => {}
    },
    alarms: {
      create: async (name, info) => {
        alarms.push({ name, info });
      },
      clear: async name => {
        const before = alarms.length;
        for (let i = alarms.length - 1; i >= 0; i--) {
          if (alarms[i].name === name) {
            alarms.splice(i, 1);
          }
        }
        return before !== alarms.length;
      }
    }
  };
  return {
    scripts: () => scripts,
    alarms: () => alarms,
    setOrigins: next => {
      grantOrigins = next;
    }
  };
}

test('enabled with no grants yet stays pending without sticky empty registration', async () => {
  const api = mockChrome({ origins: [] });
  const syncer = createBookAlertsSync({ closeParser: async () => {} });
  const first = await syncer.sync();
  assert.equal(first.status, 'pending');
  assert.equal(syncer.configuration(), '');
  assert.equal(api.scripts().length, 0);
  assert.ok(api.alarms().some(a => a.name === syncer.retryAlarmName));

  const second = await syncer.sync();
  assert.equal(second.status, 'pending');
  assert.equal(syncer.configuration(), '');
});

test('pending sync recovers and registers book-alerts once Wook origin appears', async () => {
  const api = mockChrome({ origins: [] });
  const syncer = createBookAlertsSync({ closeParser: async () => {} });
  assert.equal((await syncer.sync()).status, 'pending');

  api.setOrigins(['https://www.wook.pt/*', 'https://www.continente.pt/*']);
  const result = await syncer.sync();
  assert.equal(result.status, 'registered');
  assert.deepEqual(result.matches, ['https://www.wook.pt/*', 'https://www.continente.pt/*']);
  assert.equal(api.scripts().length, 1);
  assert.deepEqual(api.scripts()[0].matches, result.matches);
  assert.equal(syncer.configuration(), JSON.stringify([true, ['wook', 'continente']]));
});

test('pending sync does not unregister an existing book-alerts registration', async () => {
  const api = mockChrome({
    origins: [],
    registered: [['https://www.wook.pt/*']]
  });
  const syncer = createBookAlertsSync({ closeParser: async () => {} });
  assert.equal((await syncer.sync()).status, 'pending');
  assert.equal(api.scripts().length, 1, 'must not tear down while grants are still pending');
});

test('autoEnabled false unregisters book-alerts', async () => {
  const api = mockChrome({
    origins: ['https://www.wook.pt/*'],
    registered: [['https://www.wook.pt/*']]
  });
  globalThis.chrome.storage.local.get = async () => ({ autoEnabled: false });
  const syncer = createBookAlertsSync({ closeParser: async () => {} });
  assert.equal((await syncer.sync()).status, 'disabled');
  assert.equal(api.scripts().length, 0);
});
