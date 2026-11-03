import { STORES, storeForUrl } from './stores.js';
import { validCurrent } from './auto-rules.js';
let creating, syncing = Promise.resolve(), configuration = '';
async function offscreen() {
  if ((await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length) return;
  if (!creating) creating = chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['DOM_PARSER'], justification: 'Parse bookshop offers for automatic same-edition price comparisons.' }).finally(() => { creating = null; });
  await creating;
}
async function settings() {
  const data = await chrome.storage.local.get(['autoEnabled', 'selectedStores']);
  const grants = await chrome.permissions.getAll();
  const stores = STORES.filter(s => (!Array.isArray(data.selectedStores) || data.selectedStores.includes(s.id)) && grants.origins?.includes(`${s.origin}/*`));
  return { enabled: data.autoEnabled === true, stores };
}
async function sync() {
  const { enabled, stores } = await settings();
  const next = JSON.stringify([enabled, stores.map(s => s.id)]);
  if (next === configuration) return;
  configuration = next;
  const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: ['book-alerts'] });
  if (scripts.length) await chrome.scripting.unregisterContentScripts({ ids: ['book-alerts'] });
  // Close the parser to cancel pending requests and discard cached comparisons after settings changes.
  if ((await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length) await chrome.offscreen.closeDocument();
  for (const tab of await chrome.tabs.query({})) {
    if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'auto-config-changed' }).catch(() => {});
  }
  if (!enabled || !stores.length) return;
  const matches = stores.map(s => `${s.origin}/*`);
  await chrome.scripting.registerContentScripts([{ id: 'book-alerts', matches, js: ['content.js'], runAt: 'document_idle', persistAcrossSessions: true }]);
  for (const tab of await chrome.tabs.query({ url: matches })) {
    if (tab.id) await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }).catch(() => {});
  }
}
function scheduleSync() { syncing = syncing.catch(() => {}).then(sync).catch(() => { configuration = ''; }); return syncing; }
chrome.runtime.onInstalled.addListener(scheduleSync);
chrome.runtime.onStartup.addListener(scheduleSync);
chrome.permissions.onAdded.addListener(scheduleSync);
chrome.permissions.onRemoved.addListener(scheduleSync);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.autoEnabled || changes.selectedStores)) scheduleSync();
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.target !== 'background' || message.type !== 'compare-page') return;
  (async () => {
    if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0 || sender.url !== message.url || !validCurrent(message.book, sender.url)) return null;
    const { enabled, stores } = await settings();
    const source = storeForUrl(sender.url);
    if (!enabled || !stores.some(s => s.id === source.id)) return null;
    await offscreen();
    const result = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'compare', book: message.book, sourceId: source.id, storeIds: stores.map(s => s.id) });
    const latest = await settings();
    return latest.enabled && latest.stores.map(s => s.id).join() === stores.map(s => s.id).join() ? result : null;
  })().then(reply).catch(() => reply(null));
  return true;
});
