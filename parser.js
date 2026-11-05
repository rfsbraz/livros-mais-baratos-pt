import { discoverPromotion } from './promotions.js';
import { isbn13, nodes, identity, offerFrom, safeUrl, euros } from './core.js';
import { storeForUrl } from './stores.js';

export function structured(doc) {
  return [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap(el => {
    try {
      return nodes(JSON.parse(el.textContent));
    } catch {
      return [];
    }
  });
}

function numberIn(value) {
  const text = String(value || '');
  const long = text.match(/97[89](?:[\s\p{Pd}]*\d){10}/u);
  if (long) {
    return isbn13(long[0]);
  }
  return isbn13(text.match(/\d(?:[\s\p{Pd}]*\d){8}[\s\p{Pd}]*[\dXx]/u)?.[0]);
}

export function pageIsbn(doc) {
  const direct = [
    ...doc.querySelectorAll(
      '[itemprop="isbn"], [itemprop="gtin13"], meta[property="book:isbn"], [data-th="ISBN"]'
    )
  ]
    .map(el => isbn13(el.getAttribute('content') || el.textContent))
    .find(Boolean);
  if (direct) {
    return direct;
  }
  // Labels may be in table cells, definition lists or a two-column publisher grid.
  for (const label of doc.querySelectorAll('th, dt, span, strong, b, label')) {
    if (
      !/^(?:ISBN(?:[\s-]*(?:10|13))?|(?:Ref\.\s*\/\s*)?EAN)\s*:?$/i.test(label.textContent.trim())
    ) {
      continue;
    }
    const candidates = [
      label.nextElementSibling,
      label.parentElement?.nextElementSibling,
      label.parentElement
    ];
    for (const candidate of candidates) {
      const value = candidate?.textContent || '';
      if (value.length > 250) {
        continue;
      }
      const isbn = numberIn(value);
      if (isbn) {
        return isbn;
      }
    }
  }
  // Read text without cloning retailer elements or activating their resource/event lifecycle.
  const parts = [];
  if (doc.body) {
    const walker = doc.createTreeWalker(doc.body, 4, {
      acceptNode: node =>
        node.parentElement?.closest('script,style,nav,header,footer,svg,math,template') ? 2 : 1
    });
    while (walker.nextNode()) {
      parts.push(walker.currentNode.textContent);
    }
  }
  const text = parts.join('');
  const labelled = text.match(
    /(?:ISBN(?:[\s-]*(?:10|13))?|\bEAN)\s*:?\s*((?:97[89](?:[\s\p{Pd}]*\d){10})|(?:\d(?:[\s\p{Pd}]*\d){8}[\s\p{Pd}]*[\dXx]))/u
  );
  return isbn13(labelled?.[1]);
}

function nodeIdentity(node, store) {
  return identity(node) || (store?.skuIsbn ? isbn13(node.sku) : null);
}

export function detectBook(doc, url = '') {
  const store = storeForUrl(url);
  const books = structured(doc).filter(n => nodeIdentity(n, store));
  const ids = [...new Set(books.map(n => nodeIdentity(n, store)))];
  const isbn =
    pageIsbn(doc) ||
    (store?.skuIsbn && isbn13(doc.querySelector('.product_meta .sku')?.textContent)) ||
    (ids.length === 1 ? ids[0] : null);
  const book = books.find(n => nodeIdentity(n, store) === isbn);
  return {
    isbn: isbn || null,
    title: String(book?.name || doc.querySelector('h1')?.textContent || doc.title || '')
      .trim()
      .slice(0, 200)
  };
}

function primaryPrice(doc, selector) {
  const container = doc.querySelector(selector);
  const element = container?.querySelector('ins') || container;
  const displayed = element?.textContent.trim() || '';
  return /€/.test(displayed) ? euros(displayed) : null;
}

// Wook's structured data has no availability, so read the product's own label, never the help modal.
function wookInStock(doc) {
  return [...doc.querySelectorAll('#disp-information span')].some(
    span => !span.children.length && /^em stock$/i.test(span.textContent.trim())
  );
}

export function parseOffer(doc, isbn, url) {
  const store = storeForUrl(url);
  const source = new URL(url);
  const all = structured(doc);
  const productPage = !!store?.product.test(source.pathname);
  const explicit = pageIsbn(doc);
  const products = all.filter(
    n =>
      [n['@type']].flat().some(t => t === 'Product' || t === 'Book') &&
      (n.offers || nodeIdentity(n, store))
  );
  const primary = products.find(
    n =>
      nodeIdentity(n, store) === isbn &&
      (!n.url || safeUrl(n.url, url)?.split('?')[0] === url.split('?')[0])
  );
  const verifiedPage = productPage && (explicit === isbn || (products.length === 1 && primary));
  const currencies = store?.currencies || ['EUR'];
  let offer = null;
  for (const node of products) {
    if (nodeIdentity(node, store) === isbn) {
      offer = offerFrom(node, url, currencies);
      if (offer) {
        break;
      }
    }
  }
  // Some shops keep the ISBN in a labelled field, outside Product JSON-LD.
  if (
    !offer &&
    verifiedPage &&
    products.length === 1 &&
    (!nodeIdentity(products[0], store) || nodeIdentity(products[0], store) === isbn)
  ) {
    offer = offerFrom(products[0], url, currencies);
  }
  if (verifiedPage) {
    const selector = store?.id === 'wook' ? '#product-price .price' : store?.primaryPrice;
    const displayed = selector ? primaryPrice(doc, selector) : null;
    if (displayed) {
      offer = {
        ...offer,
        price: displayed,
        currency: 'EUR',
        url,
        title: String(primary?.name || doc.querySelector('h1')?.textContent || '')
          .trim()
          .slice(0, 200)
      };
    }
    if (!offer) {
      const amount = doc.querySelector(
        'meta[property="product:price:amount"], meta[property="og:price:amount"]'
      )?.content;
      const currency = doc.querySelector(
        'meta[property="product:price:currency"], meta[property="og:price:currency"]'
      )?.content;
      const price = euros(amount);
      if (price && currencies.includes(currency)) {
        offer = { price, currency, url, title: detectBook(doc, url).title };
      }
    }
  }
  if (!offer) {
    return null;
  }
  return {
    ...offer,
    ...(verifiedPage && store?.id === 'wook' && offer.currency === 'EUR'
      ? { promotionUrl: discoverPromotion(doc, url) }
      : {}),
    availability: store?.uncertainStock
      ? ''
      : offer.availability ||
        (verifiedPage && store?.id === 'wook' && wookInStock(doc) ? 'InStock' : ''),
    condition: offer.condition || (store?.marketplace ? 'UnknownCondition' : 'NewCondition')
  };
}

export function productLinks(doc, store, base) {
  const urls = [...doc.querySelectorAll(store.selector || 'a[href]')].map(a =>
    safeUrl(a.getAttribute('href'), base)
  );
  for (const node of structured(doc)) {
    if (typeof node.url === 'string') {
      urls.push(safeUrl(node.url, base));
    }
  }
  const valid = urls
    .filter(url => url && store.product.test(new URL(url).pathname))
    .map(url => {
      const u = new URL(url);
      u.hash = '';
      for (const key of [...u.searchParams.keys()]) {
        if (/^(_|utm_)/.test(key)) {
          u.searchParams.delete(key);
        }
      }
      return u.href;
    });
  return [...new Set(valid)].slice(0, 5);
}
