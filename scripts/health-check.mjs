export function inspectOffer(store, offer) {
  if (offer.status !== 'ok') return offer.status === 'unavailable' ? 'request-failed' : 'pattern-unverified';
  if (!Number.isSafeInteger(offer.price) || offer.price <= 0 ||
      !(store.currencies || ['EUR']).includes(offer.currency)) return 'invalid-offer';
  try {
    const url = new URL(offer.url);
    if (url.origin !== store.origin || !store.product.test(url.pathname)) return 'product-pattern';
  } catch { return 'product-pattern'; }
  return 'ok';
}

export function failureCode(check, requests) {
  if (check === 'ok') return 'ok';
  if (requests.some(r => [401, 403, 429].includes(r.status))) return 'access-blocked';
  if (requests.some(r => r.status >= 500)) return 'shop-server-error';
  if (requests.some(r => r.error)) return 'network-error';
  if (requests.some(r => r.status === 404 || r.status === 410)) return 'page-missing';
  return check;
}
