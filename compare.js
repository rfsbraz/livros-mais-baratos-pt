import { enrichPromotion } from './promotions.js';
import { parseOffer, productLinks } from './parser.js';
import { safeUrl, wooOffer, svelteProductLinks, wortenProductLinks } from './core.js';
import { searchUrl } from './stores.js';
import { lookupWooProduct } from './woo-products.js';
import { shopifyProductLinks, shopifySearchUrl } from './shopify-search.js';
import { lookupShopifyProduct } from './shopify-products.js';

async function loadText(url, signal) {
  const response = await fetch(url, {
    credentials: 'omit',
    redirect: 'follow',
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)])
  });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    if (safeUrl(response.url, url)) {
      error.url = response.url;
    }
    throw error;
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
  return { text: html, url: response.url, status: response.status };
}

export async function loadPage(url, signal) {
  const resource = await loadText(url, signal);
  const doc = new DOMParser().parseFromString(resource.text, 'text/html');
  Object.defineProperty(doc, 'shopUrl', { value: resource.url });
  Object.defineProperty(doc, 'httpStatus', { value: resource.status });
  return doc;
}

function searchTemplate(store, template, url) {
  if (!template) {
    return false;
  }
  const resolved = new URL(url);
  const sample = new URL(template.replace('{q}', 'QUERY'), store.origin);
  if (resolved.origin !== sample.origin) {
    return false;
  }
  const normalize = path => path.replace(/QUERY|[0-9]{10,13}/g, '{q}');
  if (normalize(resolved.pathname) !== normalize(sample.pathname)) {
    return false;
  }
  const keys = [...sample.searchParams.keys()];
  if (keys.length && !keys.every(key => resolved.searchParams.has(key))) {
    return false;
  }
  return sample.pathname !== '/' || keys.length > 0;
}

function resolvedPage(store, url) {
  try {
    const path = new URL(url).pathname;
    if (store.product.test(path)) {
      return 'product';
    }
    if ([store.query, store.titleQuery].some(template => searchTemplate(store, template, url))) {
      return 'search';
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function httpStatusCode(value) {
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : undefined;
}

function withNoPriceContext(result, store, resolvedUrl, status) {
  if (result.status !== 'unverified' && result.status !== 'unavailable') {
    return result;
  }
  const page = resolvedPage(store, resolvedUrl);
  const httpStatus = httpStatusCode(status);
  return {
    ...result,
    ...(page ? { page } : {}),
    ...(httpStatus ? { http_status: httpStatus } : {})
  };
}

export async function compareStore(store, isbn, signal, loader = loadPage, title = '') {
  const url = store.search(isbn);
  let lastUrl = url;
  let lastStatus;
  const observe = resource => {
    if (resource?.url) {
      lastUrl = resource.url;
    }
    const status = httpStatusCode(resource?.status);
    if (status) {
      lastStatus = status;
    }
    return resource;
  };
  const recall = error => {
    observe({ url: error.url, status: error.status });
    throw error;
  };
  const load = async (target, abort) => {
    try {
      const doc = await loader(target, abort);
      observe({ url: doc.shopUrl || target, status: doc.httpStatus });
      return doc;
    } catch (error) {
      return recall(error);
    }
  };
  const read = async (target, abort) => {
    try {
      return observe(await loadText(target, abort));
    } catch (error) {
      return recall(error);
    }
  };
  const json = async (endpoint, abort) => JSON.parse((await read(endpoint, abort)).text);
  const apiOffer = (target, verify) =>
    store.adapter === 'woo-product'
      ? lookupWooProduct(store, isbn, target, signal, json, verify)
      : store.adapter === 'shopify-search'
        ? lookupShopifyProduct(store, isbn, target, signal, json, verify)
        : Promise.resolve(null);
  try {
    if (signal.aborted) {
      throw new Error('Cancelado');
    }
    if (store.adapter === 'woo-sku') {
      const resource = await read(
        `${store.origin}/wp-json/wc/store/v1/products?sku=${isbn}`,
        signal
      );
      const offer = wooOffer(JSON.parse(resource.text), isbn, store.origin);
      return offer
        ? { ...store, ...offer, status: 'ok', checkedAt: Date.now() }
        : withNoPriceContext({ ...store, status: 'unverified', url }, store, lastUrl, lastStatus);
    }
    const searches = [url];
    if (title.trim()) {
      searches.push(searchUrl(store, title.trim().slice(0, 150), true));
    }
    const visited = new Set();
    let offer = await apiOffer(null);
    for (const search of searches) {
      if (offer) {
        break;
      }
      if (signal.aborted) {
        throw new Error('Cancelado');
      }
      let links;
      if (store.adapter === 'worten-search') {
        const query = new URL(search).searchParams.get('query') || isbn;
        const response = await fetch(`${store.origin}/worten-api/search-products`, {
          method: 'POST',
          credentials: 'omit',
          redirect: 'follow',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query, params: {} }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(12000)])
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        if (!safeUrl(response.url, store.origin)) {
          throw new Error('Destino fora da loja');
        }
        observe({ url: response.url, status: response.status });
        const text = await response.text();
        if (text.length > 4_000_000) {
          throw new Error('Resposta demasiado grande');
        }
        links = wortenProductLinks(JSON.parse(text), store.origin, isbn);
      } else if (store.adapter === 'svelte-search') {
        const endpoint = new URL(search);
        endpoint.pathname = '/search/__data.json';
        endpoint.searchParams.set('x-sveltekit-invalidated', '001');
        const resource = await read(endpoint.href, signal);
        links = svelteProductLinks(JSON.parse(resource.text), store.origin);
      } else {
        if (store.adapter === 'shopify-search') {
          try {
            links = shopifyProductLinks(await json(shopifySearchUrl(store, search), signal), store);
          } catch (error) {
            if (signal.aborted || /HTTP (401|403|429)\b/.test(error.message)) {
              throw error;
            }
          }
        }
        if (!links?.length) {
          const doc = await load(search, signal);
          const resolvedUrl = doc.shopUrl || search;
          offer = parseOffer(doc, isbn, resolvedUrl);
          if (offer) {
            offer = (await apiOffer(offer.url, async () => offer)) || offer;
          }
          links = productLinks(doc, store, resolvedUrl);
        }
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
            let pageOffer;
            const verify = async target => {
              if (pageOffer === undefined) {
                const product = await load(target, signal);
                pageOffer = parseOffer(product, isbn, product.shopUrl || target);
              }
              return pageOffer;
            };
            offer = (await apiOffer(link, verify)) || (await verify(link));
          } catch (error) {
            if (signal.aborted || /HTTP (401|403|429)\b/.test(error.message)) {
              throw error;
            }
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
      return withNoPriceContext(
        { ...store, status: 'unverified', url },
        store,
        lastUrl,
        lastStatus
      );
    }
    offer = await enrichPromotion(offer, loader, signal);
    return { ...store, ...offer, status: 'ok', checkedAt: Date.now() };
  } catch (error) {
    const message = error?.message || '';
    if (signal.aborted || error?.name === 'AbortError' || message === 'Cancelado') {
      if (error?.name === 'TimeoutError' || /timed?\s*out/i.test(message)) {
        return { ...store, status: 'timeout', url };
      }
      return { ...store, status: 'cancelled', url };
    }
    if (error?.name === 'TimeoutError' || /timed?\s*out/i.test(message)) {
      return { ...store, status: 'timeout', url };
    }
    if (/HTTP (401|403|429)\b/.test(message)) {
      return { ...store, status: 'blocked', url };
    }
    return { ...store, status: 'error', url };
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
