const popupOpenedAt = performance.now();
import { comparisonMetrics } from './comparison-metrics.js';
import { initFeedback } from './feedback.js';
import { comparisonValue } from './comparison-values.js';
import { eligibleOffer } from './offers.js';
import { promotionCard } from './promotion-view.js';
import { DEFAULT_STORE_IDS, selectedStoreIds } from './stores.js';
import { cachedPrices } from './price-cache.js';
import { changeData } from './data.js';
import { renderHistoryChart } from './history-view.js';
import { bindAffiliateLink, affiliateClickMetric } from './affiliate.js';
import { isbn13 } from './core.js';
import { STORES, CATALOGUE, searchUrl } from './stores.js';
import { detectBook } from './parser.js';
import { compareStore, pooled } from './compare.js';
import {
  recordPoints,
  storeResultPoint,
  latencyBucket,
  setMetricsEnabled,
  defaultMetricsEnabled,
  clearPending,
  metricsCollectionActive
} from './metrics.js';

const $ = id => document.getElementById(id);
const MIGRATE_TIMEOUT_MS = 5000;

function trackAffiliate(surface) {
  return (href, enabled) => {
    const metric = affiliateClickMetric(href, enabled);
    if (metric) {
      recordPoints([{ metric, surface, count: 1 }]).catch(() => {});
    }
  };
}

const money = (cents, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(cents / 100);
let activeMeasurement;
window.addEventListener('pagehide', () => activeMeasurement?.finish('abandoned'));
let priceCache = {},
  comparing = false;
let current = null,
  saved = {},
  history = {},
  controller = null,
  run = 0,
  activeOffers = [];
let selected = new Set(DEFAULT_STORE_IDS);
let autoEnabled = true,
  affiliateEnabled = false,
  wookPromotionEnabled = true,
  metricsEnabled = defaultMetricsEnabled();
let mainScroll = 0;
let promotionExpiryTimer;
function settingsView(open) {
  if (open) {
    mainScroll = window.scrollY;
  }
  $('main-view').hidden = open;
  $('settings-view').hidden = !open;
  $('open-settings').hidden = open;
  $('close-settings').hidden = !open;
  $('open-settings').setAttribute('aria-expanded', String(open));
  // Keep feedback visible in either view without duplicating live regions.
  (open ? $('settings-view') : $('main-view')).prepend($('status'));
  (open ? $('settings-title') : $('open-settings')).focus({ preventScroll: true });
  window.scrollTo(0, open ? 0 : mainScroll);
}
$('open-settings').onclick = () => settingsView(true);
$('close-settings').onclick = () => settingsView(false);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('settings-view').hidden) {
    event.preventDefault();
    settingsView(false);
  }
});
function autoLabel() {
  $('auto-toggle').textContent = autoEnabled
    ? 'Desativar avisos automáticos'
    : 'Ativar avisos automáticos';
  $('auto-toggle').setAttribute('aria-pressed', String(autoEnabled));
}
const status = text => {
  $('status').textContent = text;
};
function applyData(data) {
  saved = data.saved || {};
  history = data.history || {};
  priceCache = data.priceCache || priceCache;
}
async function persist() {
  const data = await changeData({ type: 'selection', ids: [...selected] });
  applyData(data);
}
function saveLabel() {
  $('save').textContent = saved[current?.isbn] ? 'Guardado' : 'Guardar';
}
function showBook(book) {
  current = book;
  $('book').hidden = false;
  $('title').textContent = book.title || 'O teu livro';
  $('edition').textContent = `ISBN ${book.isbn}`;
  saveLabel();
  renderHistory();
  renderManual();
}
function showCached() {
  if (!current || comparing) {
    return false;
  }
  const entry = cachedPrices(priceCache, current.isbn, [...selected]);
  if (!entry) {
    return false;
  }
  activeOffers = entry.offers;
  renderOffers(activeOffers);
  recordPoints([
    { metric: 'compare_run', surface: 'popup', outcome: 'cache_shown', count: 1 },
    ...entry.offers.map(o => storeResultPoint('popup', o.id, 'cached', 0)),
    ...STORES.filter(store => !selected.has(store.id)).map(store =>
      storeResultPoint('popup', store.id, 'disabled', 0)
    ),
    ...(entry.offers.some(offer => offer.status === 'ok')
      ? [
          {
            metric: 't_first_result',
            outcome: 'settled',
            bucket: latencyBucket(performance.now() - popupOpenedAt),
            count: 1
          }
        ]
      : []),
    ...(entry.offers.length === selected.size
      ? [
          {
            metric: 't_all_settled',
            outcome: 'settled',
            bucket: latencyBucket(performance.now() - popupOpenedAt),
            count: 1
          }
        ]
      : [])
  ]).catch(() => {});
  status(
    'Preços guardados: ' +
      new Date(entry.at).toLocaleString('pt-PT') +
      (entry.stale ? ' · Podem estar desatualizados.' : '') +
      ' · ' +
      entry.offers.length +
      ' lojas. Clica em Comparar para atualizar.'
  );
  return true;
}
function link(text, url) {
  const a = document.createElement('a');
  a.textContent = text;
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  bindAffiliateLink(a, () => affiliateEnabled, trackAffiliate('popup_offer'));
  return a;
}
function renderManual() {
  $('manual-results').replaceChildren();
  for (const store of CATALOGUE.filter(s => s.mode === 'manual')) {
    const row = document.createElement('div');
    row.className = 'manual-row';
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = store.reason;
    const query =
      store.group === 'used' || store.format ? current.title || current.isbn : current.isbn;
    row.append(link(store.name, searchUrl(store, query)), note);
    $('manual-results').append(row);
  }
}
function renderShops() {
  $('coverage').textContent = `Lojas: ${selected.size} de ${STORES.length} selecionadas`;
  $('shop-list').replaceChildren();
  for (const store of STORES) {
    const label = document.createElement('label');
    label.className = 'shop-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected.has(store.id);
    checkbox.value = store.id;
    checkbox.onchange = () => {
      checkbox.checked ? selected.add(store.id) : selected.delete(store.id);
      renderShops();
      persist().catch(() => status('Não foi possível guardar a seleção.'));
    };
    label.append(checkbox, document.createTextNode(store.name));
    $('shop-list').append(label);
  }
  $('references').replaceChildren();
  for (const store of CATALOGUE.filter(s => s.mode === 'reference')) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = `${store.name}: ${store.reason}`;
    $('references').append(p);
  }
}
function renderSaved() {
  $('saved').replaceChildren();
  const entries = Object.values(saved);
  $('count').textContent = entries.length;
  $('empty').hidden = entries.length > 0;
  for (const book of entries) {
    const li = document.createElement('li');
    const open = document.createElement('button');
    open.textContent = book.title || book.isbn;
    open.onclick = () => {
      $('isbn').value = book.isbn;
      $('title-query').value = book.title || '';
      start(book);
    };
    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.textContent = 'Remover';
    remove.setAttribute('aria-label', `Remover ${book.title || book.isbn}`);
    remove.onclick = async () => {
      try {
        applyData(await changeData({ type: 'remove', isbn: book.isbn }));
        renderSaved();
        saveLabel();
      } catch {
        status('Não foi possível guardar a alteração. Tenta novamente.');
      }
    };
    const watch = document.createElement('details');
    watch.className = 'watch-details';
    const summary = document.createElement('summary');
    summary.textContent = book.watch?.target
      ? `Preço-alvo: ${(book.watch.target / 100).toFixed(2).replace('.', ',')} €`
      : 'Alerta de preço';
    watch.append(summary, watchForm(book));
    li.append(open, remove, watch);
    $('saved').append(li);
  }
}
function renderHistory() {
  renderHistoryChart($('history'), history[current?.isbn] || []);
}
function updateCheapestBanner(offers) {
  const reference = current?.referencePrice;
  const candidates = offers
    .filter(eligibleOffer)
    .map(offer => ({ offer, value: comparisonValue(offer, wookPromotionEnabled) }))
    .filter(candidate => candidate.value.price !== null)
    .sort((a, b) => a.value.price - b.value.price);
  const candidate = candidates[0];
  const banner = $('cheapest-banner');
  if (!Number.isSafeInteger(reference) || !candidate || candidate.value.price >= reference) {
    banner.hidden = true;
    delete banner.dataset.price;
    return;
  }
  const changed = Number(banner.dataset.price) !== candidate.value.price;
  const improved =
    Number.isSafeInteger(Number(banner.dataset.price)) &&
    candidate.value.price < Number(banner.dataset.price);
  banner.hidden = false;
  banner.dataset.price = String(candidate.value.price);
  $('cheapest-banner-text').textContent = `${
    improved ? 'Novo preço mais baixo' : 'Preço mais baixo confirmado'
  }: ${money(candidate.value.price)} na ${candidate.offer.name} (${money(reference - candidate.value.price)} de poupança).`;
  const link = $('cheapest-banner-link');
  if (changed) {
    link.href = candidate.offer.url;
    link.textContent = `Abrir oferta na ${candidate.offer.name}`;
    bindAffiliateLink(link, () => affiliateEnabled, trackAffiliate('popup_offer'));
  }
}
function renderOffers(offers) {
  clearTimeout(promotionExpiryTimer);
  const expiry = Math.min(...offers.map(o => comparisonValue(o, wookPromotionEnabled).validUntil));
  if (Number.isFinite(expiry)) {
    promotionExpiryTimer = setTimeout(
      () => renderOffers(offers),
      Math.max(1, expiry - Date.now() + 1)
    );
  }
  $('results').replaceChildren();
  $('unconfirmed-results').replaceChildren();
  const available = offers.filter(eligibleOffer);
  const value = o => {
    const result = comparisonValue(o, wookPromotionEnabled);
    return result.price;
  };
  const known = available.filter(o => value(o) !== null);
  const best = known.length ? Math.min(...known.map(value)) : null;
  updateCheapestBanner(offers);
  const ordered = [...offers].sort(
    (a, b) =>
      (a.currency || 'EUR').localeCompare(b.currency || 'EUR') ||
      (value(a) ?? Infinity) - (value(b) ?? Infinity) ||
      (a.price || Infinity) - (b.price || Infinity)
  );
  const missing = offers.filter(o => o.status !== 'ok').length;
  $('unconfirmed-count').textContent = `${missing} lojas sem preço confirmado`;
  $('unconfirmed').hidden = missing === 0;
  for (const offer of ordered) {
    const row = document.createElement('div');
    row.className = 'offer';
    const comparison = comparisonValue(offer, wookPromotionEnabled);
    const price = document.createElement('strong');
    price.textContent = offer.status === 'ok' ? money(comparison.price, offer.currency) : '…';
    const detail = document.createElement('small');
    const availability = {
      InStock: 'Em stock',
      OutOfStock: 'Sem stock',
      PreOrder: 'Pré-venda',
      BackOrder: 'Por encomenda',
      Discontinued: 'Descontinuado',
      SoldOut: 'Esgotado'
    };
    if (offer.status === 'ok') {
      const condition =
        offer.condition === 'UsedCondition'
          ? 'Usado'
          : offer.condition === 'NewCondition'
            ? 'Novo'
            : 'Estado por confirmar';
      detail.textContent = `${condition} · ${availability[offer.availability] || 'Disponibilidade por confirmar'}${offer.marketplace ? ` · vendedor: ${offer.seller || 'confirmar na loja'}` : ''}${offer.currency !== 'EUR' ? ' · sem conversão de moeda' : ''}`;
    } else {
      detail.textContent =
        {
          loading: 'A consultar…',
          queued: 'A aguardar…',
          cancelled: 'Consulta interrompida.',
          denied: 'Acesso não autorizado. Abre a loja para consultar.'
        }[offer.status] || 'Preço não confirmado. Abre a loja para consultar.';
    }
    if (comparison.estimated) {
      price.textContent += ' estimados';
      detail.textContent += ` · A pagar agora: ${money(offer.price, offer.currency)}. Equivalente com uso integral do vale em compras futuras.`;
    }
    row.append(link(offer.name, offer.url), price, detail);
    const promotion = promotionCard(
      offer,
      () => affiliateEnabled,
      Date.now(),
      trackAffiliate('promotion_more')
    );
    if (promotion) {
      row.append(promotion);
    }
    if (best !== null && value(offer) === best && available.includes(offer)) {
      row.classList.add('best');
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = comparison.estimated
        ? 'Menor preço equivalente com vale'
        : 'Menor preço do livro novo, com stock confirmado';
      row.append(badge);
    }
    $(offer.status === 'ok' ? 'results' : 'unconfirmed-results').append(row);
  }
}
async function start(book) {
  const compareStartedAt = performance.now();
  const isbn = isbn13(book.isbn);
  if (!isbn) {
    status('Introduz um ISBN-10 ou ISBN-13 válido. Encontras o número junto ao código de barras.');
    $('isbn').focus();
    return;
  }
  const stores = STORES.filter(s => selected.has(s.id));
  if (!stores.length) {
    status('Seleciona pelo menos uma loja para comparar.');
    settingsView(true);
    $('shops').open = true;
    return;
  }
  activeMeasurement?.finish('abandoned');
  const measurement = comparisonMetrics({
    stores: stores.map(s => s.id),
    openedAt: popupOpenedAt,
    startedAt: compareStartedAt,
    trigger: book.fromPage ? 'page' : 'isbn_typed'
  });
  activeMeasurement = measurement;
  comparing = true;
  const permission = chrome.permissions.contains({ origins: stores.map(s => `${s.origin}/*`) });
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  const token = ++run;
  let knownTitle = book.title || saved[isbn]?.title || '';
  const referencePrice = current?.isbn === isbn ? current.referencePrice : null;
  showBook({ isbn, title: knownTitle, referencePrice });
  const offers = stores.map(s => ({ ...s, status: 'queued', url: s.search(isbn) }));
  activeOffers = offers;
  renderOffers(offers);
  $('cancel').hidden = false;
  status(`A consultar ${stores.length} lojas, até quatro de cada vez. Mantém esta janela aberta.`);
  try {
    const granted = await permission;
    if (token !== run) {
      return;
    }
    if (!granted) {
      renderOffers(offers.map(o => ({ ...o, status: 'denied' })));
      status('Acesso não autorizado. Podes consultar cada loja através das ligações.');
      stores.forEach(store => measurement.rendered(store.id, 'denied'));
      measurement.finish();
      return;
    }
    let complete = 0;
    await pooled(stores, async (store, index) => {
      if (signal.aborted) {
        return;
      }
      offers[index].status = 'loading';
      if (token === run) {
        renderOffers(offers);
      }
      measurement.start(store.id);
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(35000)]);
      offers[index] = await compareStore(store, isbn, deadline, undefined, knownTitle);
      if (!knownTitle && offers[index].title) {
        knownTitle = offers[index].title;
      }
      complete++;
      if (token === run) {
        if (offers[index].status === 'ok') {
          changeData({
            type: 'observe-incremental',
            isbn,
            offer: offers[index],
            source: 'manual'
          })
            .then(data => {
              if (token === run) {
                applyData(data);
              }
            })
            .catch(() => {});
        }
        renderOffers(offers);
        status(`${complete} de ${stores.length} lojas consultadas.`);
        measurement.rendered(store.id, offers[index].status);
      }
    });
    if (token !== run) {
      measurement.finish('abandoned');
      return;
    }
    measurement.finish();
    const confirmed = offers.filter(o => o.status === 'ok');
    showBook({ isbn, title: knownTitle, referencePrice });
    if (saved[isbn] && knownTitle) {
      const updated = await changeData({ type: 'save', book: { isbn, title: knownTitle } });
      if (token !== run) {
        return;
      }
      applyData(updated);
    }
    if (token !== run) {
      return;
    }
    renderSaved();
    renderHistory();
    status(
      confirmed.length
        ? `${confirmed.length} de ${stores.length} preços confirmados para esta edição. Confirma o preço final e as condições na loja.`
        : 'Não foi possível confirmar preços. Experimenta indicar também o título, ou abre as lojas para consultar.'
    );
  } catch {
    if (token === run) {
      status('Não foi possível concluir a consulta ou guardar os dados. Tenta novamente.');
    }
  } finally {
    measurement.finish(signal.aborted || token !== run ? 'abandoned' : 'settled');
    if (token === run) {
      comparing = false;
      $('cancel').hidden = true;
    }
  }
}
$('search').onsubmit = event => {
  event.preventDefault();
  start({ isbn: $('isbn').value, title: $('title-query').value.trim(), fromPage: false });
};
$('cancel').onclick = () => {
  activeMeasurement?.finish('abandoned');
  ++run;
  comparing = false;
  controller?.abort();
  $('cancel').hidden = true;
  renderOffers(
    activeOffers.map(o =>
      ['queued', 'loading'].includes(o.status) ? { ...o, status: 'cancelled' } : o
    )
  );
  status('Consulta interrompida. Os resultados parciais não foram guardados no histórico.');
};
$('select-defaults').onclick = () => {
  selected = new Set(DEFAULT_STORE_IDS);
  renderShops();
  persist().catch(() => status('Não foi possível guardar a seleção.'));
};
$('select-all').onclick = () => {
  selected = new Set(STORES.map(s => s.id));
  renderShops();
  persist().catch(() => status('Não foi possível guardar a seleção.'));
};
$('select-none').onclick = () => {
  selected.clear();
  renderShops();
  persist().catch(() => status('Não foi possível guardar a seleção.'));
};
$('auto-toggle').onclick = async () => {
  try {
    if (!autoEnabled) {
      const stores = STORES.filter(s => selected.has(s.id));
      if (!stores.length) {
        status('Seleciona pelo menos uma loja para ativar os avisos.');
        return;
      }
      if (!(await chrome.permissions.contains({ origins: stores.map(s => `${s.origin}/*`) }))) {
        status('Acesso não autorizado. Os avisos continuam desativados.');
        return;
      }
    }
    autoEnabled = !autoEnabled;
    await chrome.storage.local.set({ autoEnabled });
    autoLabel();
    status(
      autoEnabled
        ? 'Avisos ativos nas lojas autorizadas e selecionadas. Abre um livro para procurar preços mais baixos.'
        : 'Avisos automáticos desativados.'
    );
  } catch {
    status('Não foi possível alterar os avisos automáticos.');
  }
};
$('wook-promotion-toggle').onchange = async () => {
  const next = $('wook-promotion-toggle').checked;
  try {
    await chrome.storage.local.set({ wookPromotionEnabled: next });
    wookPromotionEnabled = next;
    renderOffers(activeOffers);
  } catch {
    $('wook-promotion-toggle').checked = wookPromotionEnabled;
    status('Não foi possível guardar a preferência da campanha Wook.');
  }
};
$('affiliate-toggle').onchange = async () => {
  const next = $('affiliate-toggle').checked;
  try {
    await chrome.storage.local.set({ affiliateEnabled: next });
    affiliateEnabled = next;
  } catch {
    $('affiliate-toggle').checked = affiliateEnabled;
    status('Não foi possível guardar a preferência de afiliados.');
  }
};
$('metrics-toggle').onchange = async () => {
  const next = $('metrics-toggle').checked;
  try {
    metricsEnabled = await setMetricsEnabled(next);
    $('metrics-toggle').checked = metricsEnabled;
    status(
      next && !metricsEnabled
        ? 'É necessária a autorização do Firefox para partilhar estatísticas anónimas.'
        : metricsEnabled
          ? 'Estatísticas anónimas ativas. Podes desativá-las a qualquer momento.'
          : 'Estatísticas anónimas desativadas. Os agregados pendentes foram apagados.'
    );
  } catch {
    $('metrics-toggle').checked = metricsEnabled;
    status('Não foi possível guardar a preferência de estatísticas.');
  }
};

chrome.storage.onChanged?.addListener((changes, area) => {
  if (area === 'local' && changes.wookPromotionEnabled) {
    wookPromotionEnabled = changes.wookPromotionEnabled.newValue !== false;
    $('wook-promotion-toggle').checked = wookPromotionEnabled;
    renderOffers(activeOffers);
  }
  if (area === 'local' && changes.affiliateEnabled) {
    affiliateEnabled = changes.affiliateEnabled.newValue !== false;
    $('affiliate-toggle').checked = affiliateEnabled;
  }
});
$('save').onclick = async () => {
  if (!current) {
    return;
  }
  if (!saved[current.isbn] && Object.keys(saved).length >= 100) {
    status('A estante tem 100 livros. Remove um para guardar outro.');
    return;
  }
  try {
    applyData(await changeData({ type: 'save', book: current }));
    saveLabel();
    renderSaved();
    status('Livro guardado. Volta à estante para atualizar o preço.');
  } catch {
    status('Não foi possível guardar este livro.');
  }
};
$('clear').onclick = async () => {
  if (
    !confirm(
      'Apagar a estante, o histórico e a seleção de lojas, e desativar todos os avisos e verificações agendadas?'
    )
  ) {
    return;
  }
  activeMeasurement?.finish('abandoned');
  ++run;
  comparing = false;
  controller?.abort();
  $('cancel').hidden = true;
  saved = {};
  history = {};
  selected = new Set(DEFAULT_STORE_IDS);
  try {
    applyData(await changeData({ type: 'clear' }));
    await clearPending();
    priceCache = {};
    activeOffers = [];
    renderOffers([]);
    autoEnabled = false;
    $('watch-toggle').checked = false;
    autoLabel();
    renderSaved();
    renderHistory();
    renderShops();
    renderNotices([]);
    saveLabel();
    status('Estante e histórico apagados.');
  } catch {
    status('Não foi possível apagar os dados. Tenta novamente.');
  }
};
async function init() {
  try {
    initFeedback();
    // Sem resposta do service worker em 5 s, segue com os dados guardados para não ficar parado.
    await Promise.race([
      changeData({ type: 'migrate' }),
      new Promise(resolve => setTimeout(resolve, MIGRATE_TIMEOUT_MS))
    ]).catch(() => {});
    const data = await chrome.storage.local.get([
      'saved',
      'history',
      'selectedStores',
      'autoEnabled',
      'affiliateEnabled',
      'wookPromotionEnabled',
      'watchEnabled',
      'watchNotices',
      'priceCache'
    ]);
    autoEnabled = data.autoEnabled !== false;
    autoLabel();
    wookPromotionEnabled = data.wookPromotionEnabled !== false;
    $('wook-promotion-toggle').checked = wookPromotionEnabled;
    affiliateEnabled = data.affiliateEnabled !== false;
    $('affiliate-toggle').checked = affiliateEnabled;
    metricsEnabled = await metricsCollectionActive();
    if ($('metrics-toggle')) {
      $('metrics-toggle').checked = metricsEnabled;
    }
    recordPoints([{ metric: 'popup_open', count: 1 }]).catch(() => {});
    saved = data.saved || {};
    history = data.history || {};
    priceCache = data.priceCache || {};
    selected = new Set(selectedStoreIds(data.selectedStores));
    $('watch-toggle').checked = data.watchEnabled !== false;
    renderNotices(data.watchNotices || []);
    renderSaved();
    renderShops();
    const requested = isbn13(new URLSearchParams(location.search).get('isbn'));
    if (requested && saved[requested]) {
      $('isbn').value = requested;
      showBook(saved[requested]);
      if (!showCached()) {
        status('Preço-alvo atingido. Compara novamente para confirmar a oferta.');
      }
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || '')) {
      status('Introduz um ISBN ou abre uma página de livro para começar.');
      return;
    }
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ html: document.documentElement.outerHTML.slice(0, 4_000_000) })
    });
    const book = detectBook(
      new DOMParser().parseFromString(result.result.html, 'text/html'),
      tab.url
    );
    if (run) {
      return;
    }
    if (book.isbn) {
      $('isbn').value = book.isbn;
      $('title-query').value = book.title;
      book.fromPage = true;
      showBook(book);
      if (!showCached()) {
        start(book);
      }
    } else {
      status('Não encontrei um ISBN único nesta página. Introduz o ISBN da edição que procuras.');
    }
  } catch {
    renderShops();
    status('Esta página não permite a leitura do livro. Podes introduzir o ISBN manualmente.');
  }
}

function decimal(value, optional = false) {
  if (optional && !value.trim()) {
    return null;
  }
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) {
    throw new Error('Introduz um valor em euros, com até duas casas decimais.');
  }
  const cents = Math.round(Number(value.replace(',', '.')) * 100);
  if (!Number.isSafeInteger(cents) || cents > 10000000) {
    throw new Error('Valor demasiado elevado.');
  }
  return cents;
}
function watchForm(book) {
  const form = document.createElement('form');
  form.className = 'watch-form';
  const label = document.createElement('label');
  label.textContent = 'Preço-alvo (€)';
  const target = document.createElement('input');
  target.inputMode = 'decimal';
  target.placeholder = 'Ex.: 15,00';
  target.required = true;
  target.value = book.watch ? (book.watch.target / 100).toFixed(2) : '';
  target.setAttribute('aria-label', 'Preço-alvo para ' + (book.title || book.isbn));
  label.append(target);
  const enabled = document.createElement('input');
  enabled.type = 'checkbox';
  enabled.checked = book.watch?.enabled !== false;
  const enableLabel = document.createElement('label');
  enableLabel.className = 'check-label';
  enableLabel.append(enabled, document.createTextNode('Alerta ativo'));
  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'secondary';
  button.textContent = 'Guardar alerta';
  const note = document.createElement('small');
  note.className = 'muted';
  note.textContent = book.watch?.lastCheckedAt
    ? 'Última verificação: ' +
      new Date(book.watch.lastCheckedAt).toLocaleString('pt-PT') +
      (book.watch.lastStatus === 'unavailable' ? ' · sem preços confirmados' : '')
    : 'O histórico começa com as tuas próprias consultas.';
  form.append(label, enableLabel, button, note);
  form.onsubmit = async event => {
    event.preventDefault();
    try {
      applyData(
        await changeData({
          type: 'watch',
          isbn: book.isbn,
          target: decimal(target.value),
          basis: 'item',
          enabled: enabled.checked
        })
      );
      renderSaved();
      status(
        'Preço-alvo guardado. As consultas dependem de o Chrome estar aberto e do acesso às lojas.'
      );
    } catch (error) {
      status(error.message);
    }
  };
  return form;
}
function renderNotices(notices) {
  $('watch-notices').hidden = !notices.length;
  $('notice-list').replaceChildren();
  for (const notice of notices.slice(0, 5)) {
    const li = document.createElement('li'),
      button = document.createElement('button');
    button.textContent =
      (notice.title || notice.isbn) + ' · ' + money(notice.price) + ' na ' + notice.name;
    button.onclick = () => {
      $('isbn').value = notice.isbn;
      start({ isbn: notice.isbn, title: notice.title });
    };
    li.append(button);
    $('notice-list').append(li);
  }
}
$('watch-toggle').onchange = async () => {
  await chrome.storage.local.set({ watchEnabled: $('watch-toggle').checked });
};
chrome.storage.onChanged?.addListener((changes, area) => {
  if (area !== 'local') {
    return;
  }
  if (changes.priceCache) {
    priceCache = changes.priceCache.newValue || {};
    if (!showCached() && !comparing) {
      activeOffers = [];
      renderOffers([]);
    }
  }
  if (changes.history) {
    history = changes.history.newValue || {};
    renderHistory();
  }
  if (changes.saved) {
    saved = changes.saved.newValue || {};
    if (!document.activeElement?.closest('.watch-form')) {
      renderSaved();
    }
  }
  if (changes.watchNotices) {
    renderNotices(changes.watchNotices.newValue || []);
  }
});
init();
