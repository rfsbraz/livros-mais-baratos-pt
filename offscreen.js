import { quoteDelivery, eligibleOffer } from './shipping.js';
import { STORES } from './stores.js';
import { compareStore, pooled } from './compare.js';
import { cheaperOffer } from './auto-rules.js';
const cache = new Map(),
  pending = new Map();
let active = 0;
const waiting = [];
async function withSlot(task) {
  if (active >= 4) {
    await new Promise(resolve => waiting.push(resolve));
  } else {
    active++;
  }
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) {
      next();
    } else {
      active--;
    }
  }
}
async function compare(message) {
  const { book, sourceId, storeIds } = message;
  const key = `${book.isbn}/${storeIds.join(',')}`;
  let entry = cache.get(key);
  if (!entry || Date.now() - entry.at > 10 * 60_000) {
    if (!pending.has(key)) {
      if (pending.size >= 2) {
        return { busy: true };
      }
      const job = (async () => {
        const deadline = AbortSignal.timeout(90_000);
        const offers = await pooled(
          STORES.filter(s => storeIds.includes(s.id)),
          store =>
            withSlot(async () => {
              if (deadline.aborted) {
                return { id: store.id, status: 'unavailable' };
              }
              return compareStore(
                store,
                book.isbn,
                AbortSignal.any([deadline, AbortSignal.timeout(35_000)]),
                undefined,
                String(book.title || '').slice(0, 150)
              );
            })
        );
        const result = { at: Date.now(), offers };
        cache.delete(key);
        cache.set(key, result);
        while (cache.size > 50) {
          cache.delete(cache.keys().next().value);
        }
        return result;
      })().finally(() => pending.delete(key));
      pending.set(key, job);
    }
    entry = await pending.get(key);
  }
  const currentDelivery = quoteDelivery({ ...book, id: sourceId }, message.shipping || {});
  let best,
    total,
    saving,
    basis = 'item';
  if (currentDelivery.known) {
    const candidates = entry.offers
      .filter(o => eligibleOffer(o) && o.id !== sourceId)
      .map(o => ({ ...o, delivery: quoteDelivery(o, message.shipping || {}) }))
      .filter(o => o.delivery.known && o.delivery.total < currentDelivery.total)
      .sort((a, b) => a.delivery.total - b.delivery.total);
    best = candidates[0];
    basis = 'delivered';
    total = best?.delivery.total;
    saving = currentDelivery.total - total;
    if (!best) {
      best = cheaperOffer(
        book,
        entry.offers.filter(o => !quoteDelivery(o, message.shipping || {}).known),
        sourceId
      );
      basis = 'item';
      total = best?.price;
      saving = book.price - total;
    }
  } else {
    best = cheaperOffer(book, entry.offers, sourceId);
    total = best?.price;
    saving = book.price - total;
  }
  const alert = best
    ? {
        isbn: book.isbn,
        name: best.name,
        url: best.url,
        price: total,
        itemPrice: best.price,
        currentPrice: basis === 'delivered' ? currentDelivery.total : book.price,
        currency: best.currency,
        saving,
        basis,
        checkedAt: entry.at
      }
    : null;
  const offers = entry.offers.map(o =>
    Object.fromEntries(
      [
        'id',
        'status',
        'price',
        'currency',
        'condition',
        'availability',
        'marketplace',
        'seller',
        'url',
        'title'
      ]
        .filter(k => o[k] !== undefined)
        .map(k => [k, o[k]])
    )
  );
  return { alert, prices: { at: entry.at, offers } };
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (
    message?.target !== 'offscreen' ||
    message.type !== 'compare' ||
    sender.id !== chrome.runtime.id ||
    sender.tab
  ) {
    return;
  }
  compare(message)
    .then(reply)
    .catch(() => reply(null));
  return true;
});

let watchRunning = false;
async function watchBook(message) {
  const deadline = AbortSignal.timeout(90000);
  const offers = await pooled(
    STORES.filter(s => message.storeIds.includes(s.id)),
    store =>
      withSlot(async () => {
        await new Promise(resolve => setTimeout(resolve, 500 + Math.floor(Math.random() * 1000)));
        if (deadline.aborted) {
          return { id: store.id, status: 'unavailable' };
        }
        const offer = await compareStore(
          store,
          message.book.isbn,
          AbortSignal.any([deadline, AbortSignal.timeout(35000)]),
          undefined,
          message.book.title || ''
        );
        return Object.fromEntries(
          [
            'id',
            'status',
            'price',
            'currency',
            'condition',
            'availability',
            'marketplace',
            'url',
            'title'
          ]
            .filter(k => offer[k] !== undefined)
            .map(k => [k, offer[k]])
        );
      }),
    2
  );
  await chrome.runtime.sendMessage({
    target: 'background',
    type: 'watch-result',
    token: message.token,
    isbn: message.book.isbn,
    offers
  });
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (
    message?.target !== 'offscreen' ||
    message.type !== 'watch-book' ||
    sender.id !== chrome.runtime.id ||
    sender.tab
  ) {
    return;
  }
  if (watchRunning) {
    reply({ accepted: false });
    return;
  }
  watchRunning = true;
  reply({ accepted: true });
  watchBook(message)
    .catch(() =>
      chrome.runtime
        .sendMessage({
          target: 'background',
          type: 'watch-result',
          token: message.token,
          isbn: message.book.isbn,
          offers: []
        })
        .catch(() => {})
    )
    .finally(() => {
      watchRunning = false;
    });
});
