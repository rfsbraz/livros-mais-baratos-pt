export function isbn13(value) {
  const s = String(value ?? '')
    .replace(/[\s\p{Pd}]/gu, '')
    .toUpperCase();
  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((a, c, i) => a + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
    if (sum % 11) {
      return null;
    }
    const base = `978${s.slice(0, 9)}`;
    const check =
      (10 - ([...base].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0) % 10)) % 10;
    return `${base}${check}`;
  }
  if (!/^97[89]\d{10}$/.test(s)) {
    return null;
  }
  return [...s].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0) % 10 === 0 ? s : null;
}

export function euros(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
  }
  let s = String(value ?? '')
    .trim()
    .replace(/\s|€|EUR/gi, '');
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return null;
  }
  return euros(Number(s));
}

export function nodes(data) {
  if (!data || typeof data !== 'object') {
    return [];
  }
  return [data, ...Object.values(data).flatMap(nodes)];
}

export function identity(node) {
  return [node.isbn, node.gtin13, node.gtin, node.gtin12].flat().map(isbn13).find(Boolean) ?? null;
}

export function safeUrl(value, base) {
  try {
    if (typeof value !== 'string' || !value) {
      return null;
    }
    const u = new URL(value, base);
    // Product cards can contain GET links that mutate carts or wishlists.
    let mutatesCart = false;
    u.searchParams.forEach((_value, key) => {
      if (/^(add[-_]to[-_](cart|wishlist)|remove[-_]item|wc-ajax|action)$/i.test(key)) {
        mutatesCart = true;
      }
    });
    if (mutatesCart) {
      return null;
    }
    return u.protocol === 'https:' &&
      u.origin === new URL(base).origin &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}

export function offerFrom(node, base, currencies = ['EUR']) {
  const offers = Array.isArray(node.offers) ? node.offers : [node.offers];
  return (
    offers
      .filter(Boolean)
      .flatMap(o => {
        // AggregateOffer.lowPrice can describe a different seller or format; do not use it.
        const price = euros(o.price);
        const rawUrl =
          typeof o.url === 'string' ? o.url : typeof node.url === 'string' ? node.url : base;
        const url = safeUrl(rawUrl, base);
        if (!price || !currencies.includes(o.priceCurrency) || !url) {
          return [];
        }
        const availability = String(o.availability || '')
          .split(/[/#]/)
          .pop();
        const condition = String(o.itemCondition || '')
          .split(/[/#]/)
          .pop();
        return [
          {
            price,
            currency: o.priceCurrency,
            condition,
            seller: String(o.seller?.name || '').slice(0, 100),
            url,
            availability,
            title: String(node.name || '').slice(0, 200)
          }
        ];
      })
      .sort((a, b) => a.price - b.price)[0] ?? null
  );
}

export { STORES } from './stores.js';

// Read only the observed Svelte search index. Never evaluate embedded page code.
// Search SKU discovers a page; the product page must independently verify the ISBN.
export function svelteProductLinks(payload, origin) {
  const links = [];
  for (const node of Array.isArray(payload?.nodes) ? payload.nodes : []) {
    const data = node?.data;
    if (node?.type !== 'data' || !Array.isArray(data)) {
      continue;
    }
    const at = index => (Number.isInteger(index) && index >= 0 ? data[index] : undefined);
    const products = at(data[0]?.products);
    const indices = at(products?.data);
    if (!Array.isArray(indices)) {
      continue;
    }
    for (const index of indices.slice(0, 5)) {
      const sku = at(at(index)?.sku);
      if (typeof sku === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(sku)) {
        links.push(`${origin}/produto/${sku}`);
      }
    }
  }
  return [...new Set(links)].slice(0, 5);
}

export function wortenProductLinks(payload, origin, isbn) {
  const details = payload?.detailsResponse;
  const products = Array.isArray(details?.productsData?.products)
    ? details.productsData.products
    : [];
  const webItems = Array.isArray(details?.productsCanonicalsData?.web_items)
    ? details.productsCanonicalsData.web_items
    : [];
  const byId = new Map(
    webItems.filter(item => item && typeof item.id === 'string').map(item => [item.id, item])
  );
  const links = [];
  for (const product of products.slice(0, 8)) {
    const refs = product?.meta?.refs || {};
    const candidates = [
      ...(Array.isArray(refs.ean) ? refs.ean : []),
      product?.properties?.text?.isbn
    ];
    if (!candidates.map(isbn13).includes(isbn)) {
      continue;
    }
    const path = byId.get(refs.webitem_id)?.url;
    const url = typeof path === 'string' ? safeUrl(path, origin) : null;
    if (url && /\/produtos\//.test(new URL(url).pathname)) {
      links.push(url);
    }
  }
  return [...new Set(links)].slice(0, 5);
}

export function wooOffer(products, isbn, origin) {
  if (!Array.isArray(products)) {
    return null;
  }
  const product = products.find(p => isbn13(p.sku) === isbn && p.type === 'simple');
  if (
    !product ||
    product.prices?.currency_code !== 'EUR' ||
    product.prices.currency_minor_unit !== 2
  ) {
    return null;
  }
  const price = Number(product.prices.price);
  const url = safeUrl(product.permalink, origin);
  if (!Number.isSafeInteger(price) || price <= 0 || !url) {
    return null;
  }
  return {
    price,
    currency: 'EUR',
    condition: 'NewCondition',
    url,
    title: String(product.name || '').slice(0, 200),
    availability:
      product.is_in_stock === true ? 'InStock' : product.is_in_stock === false ? 'OutOfStock' : ''
  };
}

export function remember(history, isbn, offers, now = Date.now(), source = 'manual') {
  const next = { ...history };
  const previous = next[isbn] || [];
  const observations = offers
    .filter(o => o.status === 'ok')
    .map(o => ({
      store: o.id,
      price: o.price,
      currency: o.currency || 'EUR',
      condition: o.condition || '',
      availability: o.availability,
      at: now,
      source
    }));
  if (observations.length) {
    next[isbn] = [...previous, ...observations]
      .filter(o => o.at >= now - 90 * 86400000)
      .slice(-360);
  }
  const entries = Object.entries(next).sort(
    (a, b) => (b[1].at(-1)?.at || 0) - (a[1].at(-1)?.at || 0)
  );
  return Object.fromEntries(entries.slice(0, 200));
}
