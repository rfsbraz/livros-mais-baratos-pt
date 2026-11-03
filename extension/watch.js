import { cachePrices } from './price-cache.js';
import { STORES } from './stores.js';
import { remember, safeUrl } from './core.js';
import { targetOffer } from './shipping.js';
import { writeData } from './data.js';
export const WATCH_ALARM = 'saved-book-check';
export function nextDue(data, now = Date.now()) {
  if (data.watchEnabled === false || (data.watchJob && now - data.watchJob.at < 180000) || now - (data.watchLastStart || 0) < 600000) return null;
  return Object.values(data.saved || {}).filter(b => b.watch?.enabled && b.watch.nextCheckAt <= now)
    .sort((a, b) => a.watch.nextCheckAt - b.watch.nextCheckAt)[0] || null;
}
export function completeWatch(data, message, now = Date.now()) {
  const job = data.watchJob, book = data.saved?.[message.isbn];
  if (!job || job.token !== message.token || !book?.watch?.enabled || data.watchEnabled === false ||
      book.watch.revision !== job.revision) return null;
  const next = structuredClone(data), watch = next.saved[book.isbn].watch;
  const offers = (message.offers || []).filter(o => {
    const s = STORES.find(s => s.id === o.id);
    return s && (o.status !== 'ok' || (Number.isSafeInteger(o.price) && o.price > 0 && /^[A-Z]{3}$/.test(o.currency || ''))) && job.storeIds.includes(s.id) && (!data.selectedStores || data.selectedStores.includes(s.id)) &&
      (!o.url || safeUrl(o.url, s.origin));
  });
  next.watchJob = null;
  watch.nextCheckAt = now + 86400000 + Math.floor(Math.random() * 900000);
  watch.lastCheckedAt = now;
  watch.lastStatus = offers.some(o => o.status === 'ok') ? 'ok' : 'unavailable';
  next.priceCache = cachePrices(next.priceCache, book.isbn, offers, now, now);
  next.history = remember(next.history || {}, book.isbn, offers, now, 'scheduled');
  const best = targetOffer(offers, watch, data.shipping || {}, now);
  if (best && (!Number.isFinite(watch.lastNotifiedPrice) || best.targetPrice < watch.lastNotifiedPrice)) {
    watch.lastNotifiedPrice = best.targetPrice;
    const notice = { isbn: book.isbn, title: book.title, store: best.id, name: STORES.find(s => s.id === best.id).name,
      price: best.targetPrice, itemPrice: best.price, basis: watch.basis, region: data.shipping?.region || 'mainland',
      url: best.url, at: now };
    next.watchNotices = [notice, ...(next.watchNotices || []).filter(n => n.isbn !== book.isbn)].slice(0, 100);
    return { data: next, notice };
  }
  return { data: next };
}
export function installWatch(offscreen) {
  async function ensureAlarm() {
    const data = await chrome.storage.local.get(['saved', 'watchEnabled']);
    const enabled = data.watchEnabled !== false && Object.values(data.saved || {}).some(b => b.watch?.enabled);
    const alarm = await chrome.alarms.get(WATCH_ALARM);
    if (enabled && !alarm) await chrome.alarms.create(WATCH_ALARM, { delayInMinutes: 1, periodInMinutes: 5 });
    if (!enabled && alarm) await chrome.alarms.clear(WATCH_ALARM);
  }
  async function tick() {
    const grants = await chrome.permissions.getAll();
    let launch;
    await writeData(data => {
      const book = nextDue(data);
      if (!book) return null;
      const stores = STORES.filter(s => (!data.selectedStores || data.selectedStores.includes(s.id)) && grants.origins?.includes(s.origin + '/*'));
      if (!stores.length) return null;
      const token = crypto.randomUUID();
      data.watchLastStart = Date.now();
      data.watchJob = { token, isbn: book.isbn, revision: book.watch.revision, at: Date.now(), storeIds: stores.map(s => s.id) };
      launch = { target: 'offscreen', type: 'watch-book', token, book: { isbn: book.isbn, title: book.title }, storeIds: data.watchJob.storeIds };
      return data;
    });
    if (!launch) return;
    try {
      await offscreen();
      const accepted = await chrome.runtime.sendMessage(launch);
      if (!accepted?.accepted) throw new Error('Busy');
    } catch {
      await writeData(data => { if (data.watchJob?.token === launch.token) data.watchJob = null; return data; });
    }
  }
  chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === WATCH_ALARM) tick().catch(() => {}); });
  chrome.runtime.onInstalled.addListener(() => ensureAlarm().catch(() => {}));
  chrome.runtime.onStartup.addListener(() => ensureAlarm().then(tick).catch(() => {}));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.saved || changes.watchEnabled)) ensureAlarm().catch(() => {});
    if (area === 'local' && changes.watchEnabled?.newValue === false) {
      writeData(data => { data.watchJob = null; return data; }).catch(() => {});
    }
  });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.target !== 'background' || message.type !== 'watch-result' || sender.id !== chrome.runtime.id ||
        sender.tab || sender.url !== chrome.runtime.getURL('offscreen.html')) return;
    (async () => {
      let notice;
      await writeData(data => {
        const result = completeWatch(data, message);
        notice = result?.notice;
        return result?.data;
      });
      if (notice) {
        const money = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(notice.price / 100);
        await chrome.notifications.create('target-' + notice.isbn, { type: 'basic', iconUrl: 'icons/128.png',
          title: 'O teu preço-alvo foi atingido',
          message: (notice.title || notice.isbn) + ': ' + money + ' na ' + notice.name + (notice.basis === 'delivered' ? ' (total estimado)' : ' (sem portes)') }).catch(() => {});
      }
      return { ok: true };
    })().then(reply).catch(() => reply({ ok: false }));
    return true;
  });
  chrome.notifications.onClicked.addListener(id => {
    if (/^target-\d{13}$/.test(id)) chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?isbn=' + id.slice(7)) });
  });
  ensureAlarm().catch(() => {});
}
