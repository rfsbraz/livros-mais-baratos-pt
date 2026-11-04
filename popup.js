import { comparisonValue } from './comparison-values.js';
import { promotionCard } from './promotion-view.js';
import { DEFAULT_STORE_IDS, selectedStoreIds } from './stores.js';
import { cachedPrices } from './price-cache.js';
import { changeData } from './data.js';
import { shippingRule, REGIONS } from './shipping.js';
import { renderHistoryChart } from './history-view.js';
import { bindAffiliateLink } from './affiliate.js';
import { isbn13 } from './core.js';
import { STORES, CATALOGUE, searchUrl } from './stores.js';
import { detectBook } from './parser.js';
import { compareStore, pooled } from './compare.js';

const $ = id => document.getElementById(id);
const money = (cents, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(cents / 100);
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
  shipping = { region: 'mainland' },
  priceOrder = 'delivered';
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
function link(text, url, eligible = false) {
  const a = document.createElement('a');
  a.textContent = text;
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  bindAffiliateLink(a, () => affiliateEnabled, eligible);
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
    li.append(open, remove, watchForm(book));
    $('saved').append(li);
  }
}
function renderHistory() {
  renderHistoryChart($('history'), history[current?.isbn] || []);
}
function renderOffers(offers) {
  clearTimeout(promotionExpiryTimer);
  const expiry = Math.min(
    ...offers.map(o => comparisonValue(o, shipping, wookPromotionEnabled).validUntil)
  );
  if (Number.isFinite(expiry)) {
    promotionExpiryTimer = setTimeout(
      () => renderOffers(offers),
      Math.max(1, expiry - Date.now() + 1)
    );
  }
  $('results').replaceChildren();
  $('unconfirmed-results').replaceChildren();
  const available = offers.filter(
    o =>
      o.status === 'ok' &&
      o.availability === 'InStock' &&
      (o.currency || 'EUR') === 'EUR' &&
      o.condition === 'NewCondition' &&
      !o.marketplace
  );
  const value = o => {
    const result = comparisonValue(o, shipping, wookPromotionEnabled);
    return priceOrder === 'delivered' ? result.total : result.price;
  };
  const known = available.filter(o => value(o) !== null);
  const best = known.length ? Math.min(...known.map(value)) : null;
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
    const comparison = comparisonValue(offer, shipping, wookPromotionEnabled);
    const delivery = comparison.delivery;
    const price = document.createElement('strong');
    price.textContent =
      offer.status === 'ok'
        ? money(
            priceOrder === 'delivered' && delivery.known ? comparison.total : comparison.price,
            offer.currency
          )
        : '…';
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
    if (offer.status === 'ok') {
      detail.textContent += delivery.known
        ? ' · Livro ' +
          money(offer.price, offer.currency) +
          ' + portes ' +
          money(delivery.shipping) +
          ' · ' +
          delivery.reason
        : ' · ' + delivery.reason;
      if (delivery.remaining > 0) {
        detail.textContent += ' · Faltam ' + money(delivery.remaining) + ' para portes grátis';
      }
    }
    if (comparison.estimated) {
      price.textContent += ' estimados';
      detail.textContent += ` · A pagar agora: ${money(priceOrder === 'delivered' && delivery.known ? delivery.total : offer.price, offer.currency)}. Equivalente com uso integral do vale em compras futuras.`;
    }
    const cheaper =
      available.includes(offer) &&
      value(offer) !== null &&
      available.some(other => value(other) !== null && value(other) > value(offer));
    row.append(link(offer.name, offer.url, cheaper), price, detail);
    const promotion = promotionCard(offer, () => affiliateEnabled);
    if (promotion) {
      row.append(promotion);
    }
    if (best !== null && value(offer) === best && available.includes(offer)) {
      row.classList.add('best');
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent =
        priceOrder === 'delivered'
          ? 'Menor total estimado entre portes conhecidos'
          : comparison.estimated
            ? 'Menor preço equivalente com vale'
            : 'Menor preço do livro novo, com stock confirmado';
      row.append(badge);
    }
    $(offer.status === 'ok' ? 'results' : 'unconfirmed-results').append(row);
  }
}
async function start(book) {
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
  comparing = true;
  const permission = chrome.permissions.contains({ origins: stores.map(s => `${s.origin}/*`) });
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  const token = ++run;
  let knownTitle = book.title || saved[isbn]?.title || '';
  showBook({ isbn, title: knownTitle });
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
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(35000)]);
      offers[index] = await compareStore(store, isbn, deadline, undefined, knownTitle);
      if (!knownTitle && offers[index].title) {
        knownTitle = offers[index].title;
      }
      complete++;
      if (token === run) {
        renderOffers(offers);
        status(`${complete} de ${stores.length} lojas consultadas.`);
      }
    });
    if (token !== run) {
      return;
    }
    const found = offers.filter(o => o.status === 'ok');
    showBook({ isbn, title: knownTitle });
    const observed = await changeData({ type: 'observe', isbn, offers: found, source: 'manual' });
    if (token !== run) {
      return;
    }
    applyData(observed);
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
      found.length
        ? `${found.length} de ${stores.length} preços confirmados para esta edição. Confirma os portes e condições na loja.`
        : 'Não foi possível confirmar preços. Experimenta indicar também o título, ou abre as lojas para consultar.'
    );
  } catch {
    if (token === run) {
      status('Não foi possível concluir a consulta ou guardar os dados. Tenta novamente.');
    }
  } finally {
    if (token === run) {
      comparing = false;
      $('cancel').hidden = true;
    }
  }
}
$('search').onsubmit = event => {
  event.preventDefault();
  start({ isbn: $('isbn').value, title: $('title-query').value.trim() });
};
$('cancel').onclick = () => {
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
  ++run;
  comparing = false;
  controller?.abort();
  $('cancel').hidden = true;
  saved = {};
  history = {};
  selected = new Set(DEFAULT_STORE_IDS);
  try {
    applyData(await changeData({ type: 'clear' }));
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
    const data = await chrome.storage.local.get([
      'saved',
      'history',
      'selectedStores',
      'autoEnabled',
      'affiliateEnabled',
      'wookPromotionEnabled',
      'shipping',
      'watchEnabled',
      'watchNotices',
      'priceOrder',
      'priceCache'
    ]);
    autoEnabled = data.autoEnabled !== false;
    autoLabel();
    wookPromotionEnabled = data.wookPromotionEnabled !== false;
    $('wook-promotion-toggle').checked = wookPromotionEnabled;
    affiliateEnabled = data.affiliateEnabled !== false;
    $('affiliate-toggle').checked = affiliateEnabled;
    saved = data.saved || {};
    history = data.history || {};
    priceCache = data.priceCache || {};
    selected = new Set(selectedStoreIds(data.selectedStores));
    shipping = data.shipping || { region: 'mainland' };
    priceOrder = data.priceOrder || 'delivered';
    initShipping();
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
      showBook(book);
      if (!showCached()) {
        status('Livro detetado. Clica em Comparar para consultar as livrarias.');
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
  const basis = document.createElement('select');
  basis.setAttribute('aria-label', 'Tipo de preço-alvo');
  for (const [value, text] of [
    ['delivered', 'Total com portes'],
    ['item', 'Só o livro']
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    basis.append(option);
  }
  basis.value = book.watch?.basis || 'delivered';
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
  form.append(label, basis, enableLabel, button, note);
  form.onsubmit = async event => {
    event.preventDefault();
    try {
      applyData(
        await changeData({
          type: 'watch',
          isbn: book.isbn,
          target: decimal(target.value),
          basis: basis.value,
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
      (notice.title || notice.isbn) +
      ' · ' +
      money(notice.price) +
      ' na ' +
      notice.name +
      (notice.basis === 'delivered'
        ? ' com portes estimados (' + (REGIONS[notice.region] || notice.region) + ')'
        : ' sem portes');
    button.onclick = () => {
      $('isbn').value = notice.isbn;
      start({ isbn: notice.isbn, title: notice.title });
    };
    li.append(button);
    $('notice-list').append(li);
  }
}
function localDateTime(time) {
  const date = new Date(time);
  return new Date(time - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function loadShippingRule() {
  const rule = shippingRule($('shipping-store').value, shipping) || {};
  $('shipping-fee').value = Number.isInteger(rule.fee) ? (rule.fee / 100).toFixed(2) : '';
  $('shipping-minimum').value = Number.isInteger(rule.freeFrom)
    ? (rule.freeFrom / 100).toFixed(2)
    : '';
  $('shipping-expires').value = new Date(rule.expiresAt || Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  $('shipping-source').replaceChildren();
  if (rule.source?.startsWith('https://')) {
    $('shipping-source').append(
      document.createTextNode('Regra publicada: '),
      link('consultar fonte', rule.source)
    );
  } else {
    $('shipping-source').textContent =
      rule.source === 'manual'
        ? 'Regra introduzida por ti.'
        : 'Sem regra verificada. Introduz os custos confirmados na loja.';
  }
  if (rule.note) {
    $('shipping-source').append(document.createTextNode(' ' + rule.note));
  }
  $('shipping-promo').checked = !!rule.promotion;
  $('promotion-fields').hidden = !$('shipping-promo').checked;
  $('promo-minimum').value = ((rule.promotion?.minimum || 0) / 100).toFixed(2);
  $('promo-start').value = localDateTime(rule.promotion?.startsAt || Date.now());
  $('promo-end').value = rule.promotion?.endsAt ? localDateTime(rule.promotion.endsAt) : '';
}
function initShipping() {
  $('delivery-region').replaceChildren();
  $('shipping-store').replaceChildren();
  for (const [value, name] of Object.entries(REGIONS)) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = name;
    $('delivery-region').append(o);
  }
  for (const store of STORES) {
    const o = document.createElement('option');
    o.value = store.id;
    o.textContent = store.name;
    $('shipping-store').append(o);
  }
  $('delivery-region').value = shipping.region || 'mainland';
  $('price-order').value = priceOrder;
  loadShippingRule();
}
$('delivery-region').onchange = async () => {
  try {
    shipping = { ...shipping, region: $('delivery-region').value };
    await changeData({ type: 'shipping', value: shipping });
    loadShippingRule();
    renderOffers(activeOffers);
  } catch (error) {
    status(error.message);
  }
};
$('price-order').onchange = async () => {
  priceOrder = $('price-order').value;
  await chrome.storage.local.set({ priceOrder });
  renderOffers(activeOffers);
};
$('shipping-store').onchange = loadShippingRule;
$('shipping-promo').onchange = () => {
  $('promotion-fields').hidden = !$('shipping-promo').checked;
};
$('shipping-form').onsubmit = async event => {
  event.preventDefault();
  try {
    const expiresAt = Date.parse($('shipping-expires').value + 'T23:59:59');
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new Error('Escolhe uma data futura para rever a regra.');
    }
    const rule = {
      fee: decimal($('shipping-fee').value, true),
      freeFrom: decimal($('shipping-minimum').value, true),
      source: 'manual',
      verifiedAt: Date.now(),
      expiresAt
    };
    if ($('shipping-promo').checked) {
      const startsAt = Date.parse($('promo-start').value),
        endsAt = Date.parse($('promo-end').value);
      if (
        !Number.isFinite(startsAt) ||
        !Number.isFinite(endsAt) ||
        endsAt <= startsAt ||
        endsAt <= Date.now()
      ) {
        throw new Error('Indica o início e o fim válido da campanha.');
      }
      rule.promotion = {
        verified: true,
        region: shipping.region || 'mainland',
        minimum: decimal($('promo-minimum').value),
        startsAt,
        endsAt,
        source: 'manual'
      };
    }
    const region = shipping.region || 'mainland',
      id = $('shipping-store').value;
    shipping = {
      ...shipping,
      rules: { ...shipping.rules, [region]: { ...shipping.rules?.[region], [id]: rule } }
    };
    await changeData({ type: 'shipping', value: shipping });
    loadShippingRule();
    renderOffers(activeOffers);
    status('Regra de portes guardada para este destino.');
  } catch (error) {
    status(error.message);
  }
};
$('shipping-reset').onclick = async () => {
  const region = shipping.region || 'mainland',
    rules = structuredClone(shipping.rules || {});
  delete rules[region]?.[$('shipping-store').value];
  shipping = { ...shipping, rules };
  await changeData({ type: 'shipping', value: shipping });
  loadShippingRule();
  renderOffers(activeOffers);
};
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
