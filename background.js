import { installMetrics, ensureMetricsAlarm } from './metrics.js';
import { cachePrices } from './price-cache.js';
import { writeData } from './data.js';
import { installWatch } from './watch.js';
import { storeForUrl } from './stores.js';
import { validCurrent } from './auto-rules.js';
import { createBookAlertsSync, readAutoSettings } from './book-alerts-sync.js';

let creating;
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

async function closeParser() {
  if (chrome.offscreen) {
    if ((await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length) {
      await chrome.offscreen.closeDocument();
    }
  } else {
    document.getElementById('parser-frame')?.remove();
    creating = null;
  }
}

const bookAlerts = createBookAlertsSync({ closeParser });
const { scheduleSync } = bookAlerts;

chrome.runtime.onInstalled.addListener(scheduleSync);
chrome.runtime.onStartup.addListener(scheduleSync);
chrome.permissions.onAdded.addListener(scheduleSync);
chrome.permissions.onRemoved.addListener(scheduleSync);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.autoEnabled || changes.selectedStores)) {
    scheduleSync();
  }
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === bookAlerts.retryAlarmName) {
    scheduleSync();
  }
});
// SW restarts and install races: register as soon as this module loads, not only on events.
scheduleSync();

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
    const { enabled, stores, cacheEpoch, wookPromotionEnabled } = await readAutoSettings();
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
      wookPromotionEnabled
    });
    const latest = await readAutoSettings();
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
writeData({ type: 'migrate' }).catch(error =>
  console.error('Falha ao atualizar preferências:', error)
);
installWatch(offscreen);

installMetrics();
ensureMetricsAlarm().catch(() => {});
