import { parseOffer, productLinks } from './parser.js';
import { safeUrl, wooOffer } from './core.js';

async function loadText(url, signal) {
  const response = await fetch(url, { credentials: 'omit', redirect: 'follow', signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!safeUrl(response.url, url)) throw new Error('Destino fora da loja');
  if (Number(response.headers.get('content-length')) > 4_000_000) throw new Error('Resposta demasiado grande');
  const html = await response.text();
  if (html.length > 4_000_000) throw new Error('Resposta demasiado grande');
  return { text: html, url: response.url };
}

export async function loadPage(url, signal) {
  const resource = await loadText(url, signal);
  const doc = new DOMParser().parseFromString(resource.text, 'text/html');
  Object.defineProperty(doc, 'shopUrl', { value: resource.url });
  return doc;
}

export async function compareStore(store, isbn, signal, loader = loadPage) {
  const url = store.search(isbn);
  try {
    if (store.id === 'bookcover') {
      const resource = await loadText(`${store.origin}/wp-json/wc/store/v1/products?sku=${isbn}`, signal);
      const offer = wooOffer(JSON.parse(resource.text), isbn, store.origin);
      return offer ? { ...store, ...offer, status: 'ok', checkedAt: Date.now() } : { ...store, status: 'unverified', url };
    }
    const doc = await loader(url, signal);
    const resolvedUrl = doc.shopUrl || url;
    let offer = parseOffer(doc, isbn, resolvedUrl);
    if (!offer) {
      for (const link of productLinks(doc, store, resolvedUrl)) {
        if (signal.aborted) throw new Error('Cancelado');
        try {
          const product = await loader(link, signal);
          offer = parseOffer(product, isbn, product.shopUrl || link);
        } catch { /* Try the next exact-edition candidate. */ }
        if (offer) break;
      }
    }
    if (!offer || !safeUrl(offer.url, store.origin)) return { ...store, status: 'unverified', url };
    return { ...store, ...offer, status: 'ok', checkedAt: Date.now() };
  } catch {
    return { ...store, status: 'unavailable', url };
  }
}
