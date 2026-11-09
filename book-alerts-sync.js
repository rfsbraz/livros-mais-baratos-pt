import { selectedStoreIds, STORES } from './stores.js';

const SCRIPT_ID = 'book-alerts';
const RETRY_ALARM = 'book-alerts-sync-retry';

export async function readAutoSettings() {
  const data = await chrome.storage.local.get([
    'autoEnabled',
    'selectedStores',
    'cacheEpoch',
    'wookPromotionEnabled'
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
    enabled: data.autoEnabled !== false,
    stores
  };
}

/**
 * Keep book-alerts registration aligned with autoEnabled + granted shop origins.
 * When alerts are on but no granted shop is ready yet, do not sticky-commit that
 * empty fingerprint and do not tear down an existing registration — retry later.
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

  async function sync() {
    const { enabled, stores } = await readAutoSettings();
    const next = JSON.stringify([enabled, stores.map(s => s.id)]);
    if (next === configuration) {
      return { status: 'unchanged' };
    }

    // Grants or selection not ready yet: avoid the old sticky empty fingerprint
    // (configuration = "[true,[]]" + unregister + return) that left pages without
    // book-alerts until a later permission/storage event that might never fire.
    if (enabled && !stores.length) {
      configuration = '';
      await scheduleRetry();
      return { status: 'pending' };
    }

    configuration = next;
    await clearRetry();

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
    if (!enabled) {
      return { status: 'disabled' };
    }
    const matches = stores.map(s => `${s.origin}/*`);
    await chrome.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        matches,
        js: ['content.js'],
        runAt: 'document_idle',
        persistAcrossSessions: true
      }
    ]);
    for (const tab of await chrome.tabs.query({ url: matches })) {
      if (tab.id) {
        await chrome.scripting
          .executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
          .catch(() => {});
      }
    }
    return { status: 'registered', matches };
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
