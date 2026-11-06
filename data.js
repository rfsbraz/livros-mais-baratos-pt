import { DEFAULT_STORE_IDS } from './stores.js';
import { cachePrices } from './price-cache.js';
import { isbn13, remember } from './core.js';
import { STORES } from './stores.js';
let queue = Promise.resolve();
export function migrateData(data) {
  const next = structuredClone(data);
  delete next.shipping;
  delete next.priceOrder;
  let changed = false;
  for (const book of Object.values(next.saved || {})) {
    if (book.watch?.basis === 'delivered') {
      book.watch.basis = 'item';
      book.watch.revision = (book.watch.revision || 0) + 1;
      delete book.watch.lastNotifiedPrice;
      changed = true;
    }
  }
  if (changed) {
    next.watchJob = null;
  }
  if (next.watchNotices) {
    next.watchNotices = next.watchNotices.filter(n => n.basis !== 'delivered');
  }
  return next;
}
export function reduceData(data, action, now = Date.now()) {
  const next = migrateData(data);
  next.saved ||= {};
  next.history ||= {};
  const isbn = isbn13(action.isbn || action.book?.isbn);
  if (action.type === 'save' && isbn) {
    if (!next.saved[isbn] && Object.keys(next.saved).length >= 100) {
      throw new Error('A estante tem 100 livros.');
    }
    next.saved[isbn] = {
      ...next.saved[isbn],
      isbn,
      title: String(action.book.title || '').slice(0, 200)
    };
  } else if (action.type === 'remove' && isbn) {
    delete next.saved[isbn];
    if (next.watchJob?.isbn === isbn) {
      next.watchJob = null;
    }
    if (next.watchNotices) {
      next.watchNotices = next.watchNotices.filter(n => n.isbn !== isbn);
    }
  } else if (action.type === 'watch' && isbn && next.saved[isbn]) {
    if (!Number.isSafeInteger(action.target) || action.target <= 0 || action.target > 10000000) {
      throw new Error('Preço-alvo inválido.');
    }
    if (action.basis !== 'item') {
      throw new Error('Tipo de preço inválido.');
    }
    next.saved[isbn].watch = {
      enabled: action.enabled === true,
      target: action.target,
      basis: 'item',
      revision: (next.saved[isbn].watch?.revision || 0) + 1,
      nextCheckAt: now + 60000 + Math.floor(Math.random() * 240000)
    };
  } else if (action.type === 'observe' && isbn) {
    next.history = remember(next.history, isbn, action.offers, now, action.source || 'manual');
    next.priceCache = cachePrices(next.priceCache, isbn, action.offers, now, now);
  } else if (action.type === 'observe-incremental' && isbn && action.offer?.status === 'ok') {
    const cached = next.priceCache?.[isbn]?.offers || [];
    const offers = [...cached.filter(offer => offer.id !== action.offer.id), action.offer];
    next.history = remember(next.history, isbn, [action.offer], now, action.source || 'manual');
    next.priceCache = cachePrices(next.priceCache, isbn, offers, now, now);
  } else if (action.type === 'selection') {
    next.selectedStores = action.ids.filter(id => STORES.some(s => s.id === id));
  } else if (action.type === 'clear') {
    next.priceCache = {};
    next.cacheEpoch = (next.cacheEpoch || 0) + 1;
    next.saved = {};
    next.history = {};
    next.watchNotices = [];
    next.watchJob = null;
    next.selectedStores = [...DEFAULT_STORE_IDS];
    next.autoEnabled = false;
    next.watchEnabled = false;
  }
  return next;
}
export function writeData(action) {
  const job = queue
    .catch(() => {})
    .then(async () => {
      const data = await chrome.storage.local.get(null);
      const next =
        typeof action === 'function' ? await action(migrateData(data)) : reduceData(data, action);
      if (next) {
        const obsolete = ['shipping', 'priceOrder'].filter(key => key in data);
        if (obsolete.length) {
          await chrome.storage.local.remove(obsolete);
        }
        const patch = Object.fromEntries(
          Object.entries(next).filter(
            ([key, value]) => JSON.stringify(data[key]) !== JSON.stringify(value)
          )
        );
        if (Object.keys(patch).length) {
          await chrome.storage.local.set(patch);
        }
      }
      return next || data;
    });
  queue = job;
  return job;
}
export async function changeData(action) {
  if (chrome.runtime?.id) {
    const result = await chrome.runtime.sendMessage({
      target: 'background',
      type: 'change-data',
      action
    });
    if (!result?.ok) {
      throw new Error(result?.error || 'Não foi possível guardar os dados.');
    }
    return result.data;
  }
  // Local UI previews and browser fixtures use the same reducer without an extension worker.
  return writeData(action);
}
