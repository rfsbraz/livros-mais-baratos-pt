import { isbn13, safeUrl, wooOffer } from './core.js';

// Keep only verified edition mappings, not prices. Losing this session cache is safe.
export function createWooLookup(now = Date.now) {
  const editions = new Map();
  return async function lookup(store, isbn, url, signal, loadJson, verify) {
    const key = `${store.id}:${isbn}`;
    let known = editions.get(key);
    if (known && now() - known.at >= 86400000) {
      editions.delete(key);
      known = null;
    }
    if (!url && !known) {
      return null;
    }
    const target = safeUrl(url || known.url, store.origin);
    if (!target || !new RegExp(store.product).test(new URL(target).pathname)) {
      return null;
    }
    const canonical = value => {
      const safe = safeUrl(value, store.origin);
      return safe ? new URL(safe).pathname.replace(/\/$/, '') : '';
    };
    const endpoint = new URL('/wp-json/wc/store/v1/products', store.origin);
    endpoint.searchParams.set(
      'slug',
      decodeURIComponent(new URL(target).pathname.split('/').filter(Boolean).at(-1))
    );
    endpoint.searchParams.set('per_page', '1');
    try {
      signal.throwIfAborted();
      const products = await loadJson(endpoint.href, signal);
      const product = Array.isArray(products) && products.length === 1 ? products[0] : null;
      if (
        !product ||
        canonical(product.permalink) !== canonical(target) ||
        product.type !== 'simple'
      ) {
        editions.delete(key);
        return null;
      }
      const identifiers = [isbn13(product.sku)];
      for (const attribute of Array.isArray(product.attributes) ? product.attributes : []) {
        if (/^(isbn(?:-?13)?|ean(?:-?13)?):?$/i.test(String(attribute.name).trim())) {
          for (const term of Array.isArray(attribute.terms) ? attribute.terms : []) {
            identifiers.push(isbn13(term.name));
          }
        }
      }
      const explicit = identifiers.filter(Boolean);
      if (explicit.some(value => value !== isbn)) {
        editions.delete(key);
        return null;
      }
      const mapped = known && known.id === product.id && canonical(known.url) === canonical(target);
      if (!explicit.includes(isbn) && !mapped) {
        const verified = verify && (await verify(target));
        if (!verified || canonical(verified.url) !== canonical(target)) {
          return null;
        }
      }
      // The SKU may be an internal code. Only substitute after independent ISBN verification.
      const offer = wooOffer([{ ...product, sku: isbn }], isbn, store.origin);
      signal.throwIfAborted();
      if (offer && Number.isSafeInteger(product.id) && product.id > 0) {
        editions.delete(key);
        editions.set(key, { id: product.id, url: offer.url, at: mapped ? known.at : now() });
        while (editions.size > 200) {
          editions.delete(editions.keys().next().value);
        }
      }
      return offer;
    } catch {
      return null;
    }
  };
}

export const lookupWooProduct = createWooLookup();
