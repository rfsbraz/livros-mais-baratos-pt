import { isbn13, safeUrl } from './core.js';

export function createShopifyLookup(now = Date.now) {
  const editions = new Map();
  return async function lookup(store, isbn, candidate, signal, loadJson, verify) {
    const key = `${store.id}:${isbn}`;
    let known = editions.get(key);
    if (known && now() - known.at >= 86400000) {
      editions.delete(key);
      known = null;
    }
    if (!candidate && !known) {
      return null;
    }
    const safe = safeUrl(candidate || known.url, store.origin);
    if (!safe) {
      return null;
    }
    const url = new URL(safe);
    if (!/^\/products\/[^/]+\/?$/.test(url.pathname)) {
      return null;
    }
    url.pathname = url.pathname.replace(/\/$/, '');
    url.search = '';
    url.hash = '';
    try {
      signal.throwIfAborted();
      const product = await loadJson(`${url.href}.js`, signal);
      if (
        !product ||
        product.handle !== decodeURIComponent(url.pathname.split('/').at(-1)) ||
        !Number.isSafeInteger(product.id) ||
        !Array.isArray(product.variants)
      ) {
        editions.delete(key);
        return null;
      }
      const ids = variant => [isbn13(variant?.barcode), isbn13(variant?.sku)].filter(Boolean);
      const matches = product.variants.filter(
        v => ids(v).includes(isbn) && ids(v).every(id => id === isbn)
      );
      let variant = matches.length === 1 ? matches[0] : null;
      let mapped = false;
      if (!variant && matches.length === 0 && product.variants.length === 1) {
        const only = product.variants[0];
        if (!only || ids(only).length) {
          editions.delete(key);
          return null;
        }
        mapped =
          known && known.id === product.id && known.variant === only.id && known.url === url.href;
        if (!mapped) {
          const confirmed = verify && (await verify(url.href));
          const confirmedUrl = confirmed && safeUrl(confirmed.url, store.origin);
          if (!confirmedUrl || new URL(confirmedUrl).pathname.replace(/\/$/, '') !== url.pathname) {
            return null;
          }
        }
        variant = only;
      }
      if (
        !variant ||
        !Number.isSafeInteger(variant.id) ||
        !Number.isSafeInteger(variant.price) ||
        variant.price <= 0
      ) {
        editions.delete(key);
        return null;
      }
      // Product Ajax prices use the anonymous customer's presentment currency.
      // Never infer EUR from the store's country or from a previous page.
      const cart = await loadJson(`${store.origin}/cart.js`, signal);
      if (cart?.currency !== 'EUR') {
        return null;
      }
      signal.throwIfAborted();
      editions.delete(key);
      editions.set(key, {
        id: product.id,
        variant: variant.id,
        url: url.href,
        at: mapped ? known.at : now()
      });
      while (editions.size > 200) {
        editions.delete(editions.keys().next().value);
      }
      const offerUrl = new URL(url);
      offerUrl.searchParams.set('variant', String(variant.id));
      return {
        price: variant.price,
        currency: 'EUR',
        condition: 'NewCondition',
        url: offerUrl.href,
        title: String(product.title || '').slice(0, 200),
        availability:
          variant.available === true ? 'InStock' : variant.available === false ? 'OutOfStock' : ''
      };
    } catch (error) {
      if (signal.aborted || /HTTP (401|403|429)\b/.test(error.message)) {
        throw error;
      }
      return null;
    }
  };
}

export const lookupShopifyProduct = createShopifyLookup();
