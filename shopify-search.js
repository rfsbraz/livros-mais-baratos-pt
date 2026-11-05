import { safeUrl } from './core.js';

export function shopifySearchUrl(store, search) {
  const url = new URL('/search/suggest.json', store.origin);
  url.searchParams.set('q', new URL(search).searchParams.get('q') || '');
  url.searchParams.set('resources[type]', 'product');
  url.searchParams.set('resources[limit]', '6');
  url.searchParams.set('resources[options][fields]', 'title,variants.sku,variants.barcode');
  return url.href;
}

// Suggestions discover candidates only. The product page must confirm ISBN and price.
export function shopifyProductLinks(payload, store) {
  const products = payload?.resources?.results?.products;
  if (!Array.isArray(products)) {
    return [];
  }
  const urls = products.slice(0, 6).map(product => {
    if (!product || typeof product.url !== 'string') {
      return null;
    }
    const safe = safeUrl(product.url, store.origin);
    if (!safe || !store.product.test(new URL(safe).pathname)) {
      return null;
    }
    const url = new URL(safe);
    // Keep only the product identity, not recommendation/tracking parameters.
    url.search = '';
    url.hash = '';
    return url.href;
  });
  return [...new Set(urls.filter(Boolean))];
}
