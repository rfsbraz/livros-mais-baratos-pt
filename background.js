import { selectedStoreIds } from './stores.js';
import { cachePrices } from './price-cache.js';
import { writeData } from './data.js';
import { installWatch } from './watch.js';
import { STORES, storeForUrl } from './stores.js';
import { validCurrent } from './auto-rules.js';
let creating,
  syncing = Promise.resolve(),
  configuration = '';
async function offscreen() {
  if (!chrome.offscreen) {
    if (!creating) {
      creating = new Promise((resolve, reject) => {
        const frame = document.createElement('iframe');
        frame.id = 'parser-frame';
        frame.hidden = true;
        frame.onload = resolve;
        frame.onerror = () => reject(new Error('Parser unavailable'));
        frame.src = chrome.runtime.getURL('offscreen.html');
        document.body.append(frame);
      });
    }
    await creating;
    return;
  }
  if ((await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length) {
    return;
  }
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: 'offscreen.html',
        reasons: ['DOM_PARSER'],
        justification: 'Parse bookshop offers for automatic same-edition price comparisons.'
      })
      .finally(() => {
        creating = null;
      });
  }
  await creating;
}
async function settings() {
  const data = await chrome.storage.local.get([
    'autoEnabled',
    'selectedStores',
    'shipping',
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
    stores,
    shipping: data.shipping || {}
  };
}
async function sync() {
  const { enabled, stores } = await settings();
  const next = JSON.stringify([enabled, stores.map(s => s.id)]);
  if (next === configuration) {
    return;
  }
  configuration = next;
  const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: ['book-alerts'] });
  if (scripts.length) {
    await chrome.scripting.unregisterContentScripts({ ids: ['book-alerts'] });
  }
  // Close the parser to cancel pending requests and discard cached comparisons after settings changes.
  if (chrome.offscreen) {
    if ((await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length) {
      await chrome.offscreen.closeDocument();
    }
  } else {
    document.getElementById('parser-frame')?.remove();
    creating = null;
  }
  for (const tab of await chrome.tabs.query({})) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'auto-config-changed' }).catch(() => {});
    }
  }
  if (!enabled || !stores.length) {
    return;
  }
  const matches = stores.map(s => `${s.origin}/*`);
  await chrome.scripting.registerContentScripts([
    {
      id: 'book-alerts',
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
chrome.runtime.onInstalled.addListener(scheduleSync);
chrome.runtime.onStartup.addListener(scheduleSync);
chrome.permissions.onAdded.addListener(scheduleSync);
chrome.permissions.onRemoved.addListener(scheduleSync);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.autoEnabled || changes.selectedStores)) {
    scheduleSync();
  }
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.target !== 'background' || message.type !== 'compare-page') {
    return;
  }
  (async () => {
    if (
      sender.id !== chrome.runtime.id ||
      !sender.tab ||
      sender.frameId !== 0 ||
      sender.url !== message.url ||
      !validCurrent(message.book, sender.url)
    ) {
      return null;
    }
    const { enabled, stores, shipping, cacheEpoch, wookPromotionEnabled } = await settings();
    const source = storeForUrl(sender.url);
    if (!enabled || !stores.some(s => s.id === source.id)) {
      return null;
    }
    await offscreen();
    const result = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'compare',
      book: message.book,
      sourceId: source.id,
      storeIds: stores.map(s => s.id),
      shipping,
      wookPromotionEnabled
    });
    const latest = await settings();
    if (
      !latest.enabled ||
      latest.cacheEpoch !== cacheEpoch ||
      latest.wookPromotionEnabled !== wookPromotionEnabled ||
      latest.stores.map(s => s.id).join() !== stores.map(s => s.id).join()
    ) {
      return null;
    }
    if (result?.prices) {
      await writeData(data => {
        if ((data.cacheEpoch || 0) !== cacheEpoch || data.autoEnabled === false) {
          return null;
        }
        data.priceCache = cachePrices(
          data.priceCache,
          message.book.isbn,
          result.prices.offers,
          result.prices.at
        );
        return data;
      });
    }
    const sourceOffer = result?.prices?.offers?.find(o => o.id === source.id && o.promotion);
    if (sourceOffer || result?.alert) {
      return { ...result?.alert, isbn: message.book.isbn, sourceOffer };
    }
    return result?.busy ? { busy: true } : null;
  })()
    .then(reply)
    .catch(() => reply(null));
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (
    message?.target !== 'background' ||
    message.type !== 'change-data' ||
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith(chrome.runtime.getURL('popup.html'))
  ) {
    return;
  }
  writeData(message.action)
    .then(data => reply({ ok: true, data }))
    .catch(error => reply({ ok: false, error: error.message }));
  return true;
});
installWatch(offscreen);
