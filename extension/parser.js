import { isbn13, nodes, identity, offerFrom, safeUrl, euros } from './core.js';

export function structured(doc) {
  return [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap(el => {
    try { return nodes(JSON.parse(el.textContent)); } catch { return []; }
  });
}

export function pageIsbn(doc) {
  const meta = [...doc.querySelectorAll('[itemprop="isbn"], [itemprop="gtin13"], meta[property="book:isbn"], [data-th="ISBN"]')]
    .map(el => isbn13(el.getAttribute('content') || el.textContent)).find(Boolean);
  if (meta) return meta;
  const explicit = doc.body?.textContent.match(/ISBN(?:-1[03])?\s*:?\s*([\d][\d\s-]{8,24}[\dXx])/);
  return isbn13(explicit?.[1]);
}

export function detectBook(doc, url = '') {
  if (url.startsWith('https://bookcover.pt/product/')) {
    const isbn = isbn13(doc.querySelector('.product_meta .sku')?.textContent);
    if (isbn) return { isbn, title: String(doc.querySelector('h1')?.textContent || '').trim().slice(0, 200) };
  }
  const books = structured(doc).filter(n => identity(n));
  const ids = [...new Set(books.map(identity))];
  const isbn = pageIsbn(doc) || (ids.length === 1 ? ids[0] : null);
  const book = books.find(n => identity(n) === isbn);
  return { isbn, title: String(book?.name || doc.querySelector('h1')?.textContent || doc.title || '').trim().slice(0, 200) };
}

export function parseOffer(doc, isbn, url) {
  const all = structured(doc);
  const source = new URL(url);
  // Wook's Book offer omits currency. Read only the primary purchase box,
  // which explicitly contains EUR; never infer currency from unrelated prices.
  if (source.hostname === 'www.wook.pt' && source.pathname.startsWith('/livro/')) {
    const book = all.find(n => identity(n) === isbn);
    const displayed = doc.querySelector('#product-price .price')?.textContent || '';
    const price = /€/.test(displayed) ? euros(displayed) : null;
    if (book && price) return { price, url, availability: '', title: String(book.name || '').slice(0, 200) };
  }
  for (const n of all) {
    if (identity(n) !== isbn) continue;
    const offer = offerFrom(n, url);
    if (offer) return offer;
  }
  // Some shops put the ISBN on Book and the offer on a separate Product.
  // This fallback is only allowed on a verified single-product page, never search pages.
  if (pageIsbn(doc) !== isbn || /\/pesquisa(?:\/|\?)|catalogsearch|[?&]s=/.test(url)) return null;
  const products = all.filter(n => [n['@type']].flat().includes('Product'));
  if (products.length === 1 && (!identity(products[0]) || identity(products[0]) === isbn)) {
    const offer = offerFrom(products[0], url);
    if (offer) return offer;
  }
  const price = euros(doc.querySelector('meta[property="product:price:amount"]')?.content);
  const currency = doc.querySelector('meta[property="product:price:currency"]')?.content;
  if (price && currency === 'EUR') return { price, url, availability: '', title: detectBook(doc).title };
  return null;
}

export function productLinks(doc, store, base) {
  const selector = store.id === 'almedina' ? 'a.product-item-link[href]' : 'a[href]';
  return [...new Set([...doc.querySelectorAll(selector)].map(a => safeUrl(a.getAttribute('href'), base))
    .filter(url => url && store.product.test(new URL(url).pathname)))].slice(0, 3);
}
