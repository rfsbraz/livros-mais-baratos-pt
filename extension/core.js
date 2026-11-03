export function isbn13(value) {
  const s = String(value ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((a, c, i) => a + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
    if (sum % 11) return null;
    const base = `978${s.slice(0, 9)}`;
    const check = (10 - [...base].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0) % 10) % 10;
    return `${base}${check}`;
  }
  if (!/^97[89]\d{10}$/.test(s)) return null;
  return [...s].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0) % 10 === 0 ? s : null;
}

export function euros(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
  let s = String(value ?? '').trim().replace(/\s|€|EUR/gi, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return euros(Number(s));
}

export function nodes(data) {
  if (!data || typeof data !== 'object') return [];
  return [data, ...Object.values(data).flatMap(nodes)];
}

export function identity(node) {
  return [node.isbn, node.gtin13, node.gtin, node.gtin12].flat().map(isbn13).find(Boolean) ?? null;
}

export function safeUrl(value, base) {
  try {
    const u = new URL(value, base);
    return u.protocol === 'https:' && u.origin === new URL(base).origin && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}

export function offerFrom(node, base) {
  const offers = Array.isArray(node.offers) ? node.offers : [node.offers];
  return offers.filter(Boolean).flatMap(o => {
    // AggregateOffer.lowPrice can describe a different seller or format; do not use it.
    const price = euros(o.price);
    const url = safeUrl(o.url || node.url || base, base);
    if (!price || o.priceCurrency !== 'EUR' || !url) return [];
    const availability = String(o.availability || '').split(/[\/#]/).pop();
    return [{ price, url, availability, title: String(node.name || '').slice(0, 200) }];
  }).sort((a, b) => a.price - b.price)[0] ?? null;
}

export const STORES = [
  { id: 'wook', name: 'Wook', origin: 'https://www.wook.pt', search: isbn => `https://www.wook.pt/pesquisa?keyword=${isbn}`, product: /\/livro\// },
  { id: 'bertrand', name: 'Bertrand', origin: 'https://www.bertrand.pt', search: isbn => `https://www.bertrand.pt/pesquisa/${isbn}`, product: /\/livro\// },
  { id: 'almedina', name: 'Almedina', origin: 'https://www.almedina.net', search: isbn => `https://www.almedina.net/catalogsearch/result/?q=${isbn}`, product: /\.html$|\/[^/]+-\d+\.html|\/[^/]+-\d+$/ },
  { id: 'bookcover', name: 'Bookcover', origin: 'https://bookcover.pt', search: isbn => `https://bookcover.pt/?s=${isbn}&post_type=product`, product: /\/product\// }
];

export function wooOffer(products, isbn, origin) {
  if (!Array.isArray(products)) return null;
  const product = products.find(p => isbn13(p.sku) === isbn && p.type === 'simple');
  if (!product || product.prices?.currency_code !== 'EUR' || product.prices.currency_minor_unit !== 2) return null;
  const price = Number(product.prices.price);
  const url = safeUrl(product.permalink, origin);
  if (!Number.isSafeInteger(price) || price <= 0 || !url) return null;
  return { price, url, title: String(product.name || '').slice(0, 200), availability: product.is_in_stock === true ? 'InStock' : product.is_in_stock === false ? 'OutOfStock' : '' };
}

export function remember(history, isbn, offers, now = Date.now()) {
  const next = { ...history };
  const previous = next[isbn] || [];
  const observations = offers.filter(o => o.status === 'ok').map(o => ({ store: o.id, price: o.price, availability: o.availability, at: now }));
  if (observations.length) next[isbn] = [...previous, ...observations].filter(o => o.at >= now - 90 * 86400000).slice(-360);
  const entries = Object.entries(next).sort((a, b) => (b[1].at(-1)?.at || 0) - (a[1].at(-1)?.at || 0));
  return Object.fromEntries(entries.slice(0, 200));
}
