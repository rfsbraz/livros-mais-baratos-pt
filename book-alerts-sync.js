import { selectedStoreIds, STORES } from './stores.js';
import { affiliateLinksEnabled } from './affiliate.js';

const SCRIPT_ID = 'book-alerts';
const RETRY_ALARM = 'book-alerts-sync-retry';

export async function readAutoSettings() {
  const data = await chrome.storage.local.get([
    'autoEnabled',
    'selectedStores',
    'cacheEpoch',
    'wookPromotionEnabled',
    'affiliateEnabled'
  ]);
  const grants = await chrome.permissions.getAll();
  const stores = STORES.filter(
    s =>
      selectedStoreIds(data.selectedStores).includes(s.id) &&
      grants.origins?.includes(`${s.origin}/*`)
  );
  return {
    cacheEpoch: data.cacheEpoch || 0,
    wookPromotionEnabled: data.wookPromotionEnabled !== false,
    affiliateEnabled: affiliateLinksEnabled(data.affiliateEnabled),
    enabled: data.autoEnabled !== false,
    stores,
    grantCount: grants.origins?.length || 0
  };
}

function matchesKey(matches) {
  return [...(matches || [])].sort().join('\0');
}

/**
 * Keep book-alerts registration aligned with autoEnabled + granted shop origins.
 * Install races (no origins in getAll yet) stay pending without sticky teardown.
 * Explicit empty results (grants present but none match selection, or alerts off)
 * unregister. Service-worker restarts reconcile a matching persistAcrossSessions
 * registration without closing the offscreen parser or poking open tabs.
 */
export function createBookAlertsSync({ closeParser } = {}) {
  let configuration = '';
  let syncing = Promise.resolve();

  async function clearRetry() {
    if (chrome.alarms?.clear) {
      await chrome.alarms.clear(RETRY_ALARM).catch(() => {});
    }
  }

  async function scheduleRetry() {
    if (!chrome.alarms?.create) {
      return;
    }
    await chrome.alarms.create(RETRY_ALARM, { when: Date.now() + 5000 });
  }

  async function teardownAndNotify() {
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
    if (scripts.length) {
      await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    }
    if (closeParser) {
      await closeParser();
    }
    for (const tab of await chrome.tabs.query({})) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'auto-config-changed' }).catch(() => {});
      }
    }
  }

  async function sync() {
    const { enabled, stores, grantCount } = await readAutoSettings();
    const next = JSON.stringify([enabled, stores.map(s => s.id)]);
    if (next === configuration) {
      return { status: 'unchanged' };
    }

    // Install race: getAll has no origins yet. Do not sticky-commit or tear down.
    if (enabled && !stores.length && grantCount === 0) {
      configuration = '';
      await scheduleRetry();
      return { status: 'pending' };
    }

    const desiredMatches = stores.map(s => `${s.origin}/*`);

    // SW restart: configuration is empty but persistAcrossSessions already matches.
    // Adopt without closing the parser or refreshing every tab.
    if (!configuration && enabled && stores.length) {
      const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
      if (matchesKey(existing[0]?.matches) === matchesKey(desiredMatches)) {
        configuration = next;
        await clearRetry();
        return { status: 'reconciled', matches: desiredMatches };
      }
    }

    configuration = next;
    await clearRetry();
    await teardownAndNotify();

    if (!enabled || !stores.length) {
      return { status: enabled ? 'cleared' : 'disabled' };
    }

    await chrome.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        matches: desiredMatches,
        js: ['content.js'],
        runAt: 'document_idle',
        persistAcrossSessions: true
      }
    ]);
    for (const tab of await chrome.tabs.query({ url: desiredMatches })) {
      if (tab.id) {
        await chrome.scripting
          .executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
          .catch(() => {});
      }
    }
    return { status: 'registered', matches: desiredMatches };
  }

  function scheduleSync() {
    syncing = syncing
      .catch(() => {})
      .then(sync)
      .catch(() => {
        configuration = '';
      });
    return syncing;
  }

  return {
    scheduleSync,
    sync,
    configuration: () => configuration,
    retryAlarmName: RETRY_ALARM
  };
}
