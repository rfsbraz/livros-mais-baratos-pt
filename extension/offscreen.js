import { STORES } from './stores.js';
import { compareStore, pooled } from './compare.js';
import { cheaperOffer } from './auto-rules.js';
const cache = new Map(), pending = new Map();
let active = 0;
const waiting = [];
async function withSlot(task) {
  if (active >= 4) await new Promise(resolve => waiting.push(resolve));
  else active++;
  try { return await task(); }
  finally { const next = waiting.shift(); if (next) next(); else active--; }
}
async function compare(message) {
  const { book, sourceId, storeIds } = message;
  const key = `${book.isbn}/${storeIds.join(',')}`;
  let entry = cache.get(key);
  if (!entry || Date.now() - entry.at > 10 * 60_000) {
    if (!pending.has(key)) {
      if (pending.size >= 2) return { busy: true };
      const job = (async () => {
        const deadline = AbortSignal.timeout(90_000);
        const offers = await pooled(STORES.filter(s => storeIds.includes(s.id)), store => withSlot(async () => {
          if (deadline.aborted) return { id: store.id, status: 'unavailable' };
          return compareStore(store, book.isbn, AbortSignal.any([deadline, AbortSignal.timeout(35_000)]), undefined, String(book.title || '').slice(0, 150));
        }));
        const result = { at: Date.now(), offers };
        cache.delete(key); cache.set(key, result);
        while (cache.size > 50) cache.delete(cache.keys().next().value);
        return result;
      })().finally(() => pending.delete(key));
      pending.set(key, job);
    }
    entry = await pending.get(key);
  }
  const best = cheaperOffer(book, entry.offers, sourceId);
  return best ? { isbn: book.isbn, name: best.name, url: best.url, price: best.price, currency: best.currency, saving: book.price - best.price, checkedAt: entry.at } : null;
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.target !== 'offscreen' || message.type !== 'compare' || sender.id !== chrome.runtime.id || sender.tab) return;
  compare(message).then(reply).catch(() => reply(null));
  return true;
});
