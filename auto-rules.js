import { safeUrl, isbn13 } from './core.js';
import { storeForUrl } from './stores.js';

export function validCurrent(book, url) {
  const store = storeForUrl(url);
  if (!store || store.marketplace || !store.product.test(new URL(url).pathname)) {
    return false;
  }
  if (
    !book ||
    isbn13(book.isbn) !== book.isbn ||
    !Number.isSafeInteger(book.price) ||
    book.price <= 0
  ) {
    return false;
  }
  if (book.currency !== 'EUR' || book.condition !== 'NewCondition') {
    return false;
  }
  const offerUrl = safeUrl(book.url, store.origin);
  return !!offerUrl && new URL(offerUrl).pathname === new URL(url).pathname;
}

export function cheaperOffer(current, offers, sourceId) {
  return (
    offers
      .filter(
        o =>
          o.status === 'ok' &&
          o.id !== sourceId &&
          !o.marketplace &&
          o.currency === current.currency &&
          o.condition === 'NewCondition' &&
          o.availability === 'InStock' &&
          Number.isSafeInteger(o.price) &&
          o.price > 0 &&
          o.price < current.price &&
          safeUrl(o.url, o.origin)
      )
      .sort((a, b) => a.price - b.price)[0] || null
  );
}
