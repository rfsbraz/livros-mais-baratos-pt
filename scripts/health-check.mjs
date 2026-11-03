export function inspectOffer(store, offer) {
  if (offer.status !== 'ok') {
    return offer.status === 'unavailable' ? 'request-failed' : 'pattern-unverified';
  }
  if (
    !Number.isSafeInteger(offer.price) ||
    offer.price <= 0 ||
    !(store.currencies || ['EUR']).includes(offer.currency)
  ) {
    return 'invalid-offer';
  }
  try {
    const url = new URL(offer.url);
    if (url.origin !== store.origin || !store.product.test(url.pathname)) {
      return 'product-pattern';
    }
  } catch {
    return 'product-pattern';
  }
  return 'ok';
}

export function failureCode(check, requests) {
  if (check === 'ok') {
    return 'ok';
  }
  if (requests.some(r => r.status === 429)) {
    return 'rate-limited';
  }
  if (requests.some(r => r.status === 401)) {
    return 'authentication-required';
  }
  if (requests.some(r => r.status === 403)) {
    return 'access-forbidden';
  }
  if (requests.some(r => r.status === 405)) {
    return 'method-not-allowed';
  }
  if (requests.some(r => r.status >= 500)) {
    return 'shop-server-error';
  }
  if (requests.some(r => r.error)) {
    return 'network-error';
  }
  if (requests.some(r => r.status === 404 || r.status === 410)) {
    return 'page-missing';
  }
  return check;
}

export function retryAfterUntil(value, now = Date.now()) {
  if (!value) {
    return null;
  }
  const time = /^\d+$/.test(value.trim()) ? now + Number(value) * 1000 : Date.parse(value);
  return Number.isFinite(time) && time > now ? time : null;
}

export function canRetry(status, requests) {
  return (
    !['rate-limited', 'authentication-required', 'access-forbidden', 'method-not-allowed'].includes(
      status
    ) && !requests.some(r => r.retryAfterUntil > Date.now())
  );
}
