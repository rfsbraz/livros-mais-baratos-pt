import { enrichPromotion } from './promotions.js';
import { parseOffer, productLinks } from './parser.js';
import { safeUrl, wooOffer, svelteProductLinks } from './core.js';
import { searchUrl } from './stores.js';

async function loadText(url, signal) {
  const response = await fetch(url, {
    credentials: 'omit',
    redirect: 'follow',
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)])
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  if (!safeUrl(response.url, url)) {
    throw new Error('Destino fora da loja');
  }
  if (Number(response.headers.get('content-length')) > 4_000_000) {
    throw new Error('Resposta demasiado grande');
  }
  const html = await response.text();
  if (html.length > 4_000_000) {
    throw new Error('Resposta demasiado grande');
  }
  return { text: html, url: response.url };
}

export async function loadPage(url, signal) {
  const resource = await loadText(url, signal);
  const doc = new DOMParser().parseFromString(resource.text, 'text/html');
  Object.defineProperty(doc, 'shopUrl', { value: resource.url });
  return doc;
}

export async function compareStore(store, isbn, signal, loader = loadPage, title = '') {
  const url = store.search(isbn);
  try {
    if (signal.aborted) {
      throw new Error('Cancelado');
    }
    if (store.adapter === 'woo-sku') {
      const resource = await loadText(
        `${store.origin}/wp-json/wc/store/v1/products?sku=${isbn}`,
        signal
      );
      const offer = wooOffer(JSON.parse(resource.text), isbn, store.origin);
      return offer
        ? { ...store, ...offer, status: 'ok', checkedAt: Date.now() }
        : { ...store, status: 'unverified', url };
    }
    const searches = [url];
    if (title.trim()) {
      searches.push(searchUrl(store, title.trim().slice(0, 150), true));
    }
    const visited = new Set();
    let offer = null;
    for (const search of searches) {
      if (signal.aborted) {
        throw new Error('Cancelado');
      }
      let links;
      if (store.adapter === 'svelte-search') {
        const endpoint = new URL(search);
        endpoint.pathname = '/search/__data.json';
        endpoint.searchParams.set('x-sveltekit-invalidated', '001');
        const resource = await loadText(endpoint.href, signal);
        links = svelteProductLinks(JSON.parse(resource.text), store.origin);
      } else {
        const doc = await loader(search, signal);
        const resolvedUrl = doc.shopUrl || search;
        offer = parseOffer(doc, isbn, resolvedUrl);
        links = productLinks(doc, store, resolvedUrl);
      }
      if (!offer) {
        for (const link of links) {
          if (signal.aborted) {
            throw new Error('Cancelado');
          }
          if (visited.has(link) || visited.size >= 6) {
            continue;
          }
          visited.add(link);
          try {
            const product = await loader(link, signal);
            offer = parseOffer(product, isbn, product.shopUrl || link);
          } catch {
            /* Try the next exact-edition candidate. */
          }
          if (offer) {
            break;
          }
        }
      }
      if (offer) {
        break;
      }
    }
    if (!offer || !safeUrl(offer.url, store.origin)) {
      return { ...store, status: 'unverified', url };
    }
    offer = await enrichPromotion(offer, loader, signal);
    return { ...store, ...offer, status: 'ok', checkedAt: Date.now() };
  } catch {
    return { ...store, status: 'unavailable', url };
  }
}

export async function pooled(items, task, concurrency = 4) {
  let next = 0;
  const results = new Array(items.length);
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await task(items[index], index);
      }
    })
  );
  return results;
}
