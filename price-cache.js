import { STORES } from './stores.js';
import { safeUrl } from './core.js';
export const CACHE_FRESH_MS = 10 * 60000;
export const CACHE_MAX_MS = 24 * 3600000;
export function cachePrices(cache = {}, isbn, offers, at = Date.now(), now = Date.now()) {
  const next = Object.fromEntries(
    Object.entries(cache).filter(([, e]) => e.at <= now && now - e.at < CACHE_MAX_MS)
  );
  if (!Number.isFinite(at) || at > now || now - at >= CACHE_MAX_MS || (next[isbn]?.at || 0) > at) {
    return next;
  }
  const clean = offers.flatMap(o => {
    const store = STORES.find(s => s.id === o.id);
    if (
      !store ||
      o.status !== 'ok' ||
      !Number.isSafeInteger(o.price) ||
      o.price <= 0 ||
      !/^[A-Z]{3}$/.test(o.currency || '') ||
      !safeUrl(o.url, store.origin)
    ) {
      return [];
    }
    return [
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
          'promotion',
          'url',
          'title'
        ]
          .filter(k => o[k] !== undefined)
          .map(k => [k, o[k]])
      )
    ];
  });
  next[isbn] = { at, offers: clean };
  return Object.fromEntries(
    Object.entries(next)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, 50)
  );
}
export function cachedPrices(cache, isbn, selected, now = Date.now()) {
  const entry = cache?.[isbn];
  if (!entry || entry.at > now || now - entry.at >= CACHE_MAX_MS) {
    return null;
  }
  const offers = entry.offers
    .filter(o => selected.includes(o.id))
    .map(o => ({ ...STORES.find(s => s.id === o.id), ...o }));
  return offers.length ? { at: entry.at, offers, stale: now - entry.at >= CACHE_FRESH_MS } : null;
}
