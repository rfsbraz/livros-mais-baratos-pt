import { isbn13, remember } from './core.js';
import { STORES, CATALOGUE, searchUrl } from './stores.js';
import { detectBook } from './parser.js';
import { compareStore, pooled } from './compare.js';

const $ = id => document.getElementById(id);
const money = (cents, currency = 'EUR') => new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(cents / 100);
let current = null, saved = {}, history = {}, controller = null, run = 0, activeOffers = [];
let selected = new Set(STORES.map(s => s.id));
let autoEnabled = false;
function autoLabel() { $('auto-toggle').textContent = autoEnabled ? 'Desativar avisos automáticos' : 'Ativar avisos automáticos'; $('auto-toggle').setAttribute('aria-pressed', String(autoEnabled)); }
let writes = Promise.resolve();
const status = text => { $('status').textContent = text; };
function persist() {
  const snapshot = structuredClone({ saved, history, selectedStores: [...selected] });
  writes = writes.catch(() => {}).then(() => chrome.storage.local.set(snapshot));
  return writes;
}
function saveLabel() { $('save').textContent = saved[current?.isbn] ? 'Guardado' : 'Guardar'; }
function showBook(book) {
  current = book; $('book').hidden = false;
  $('title').textContent = book.title || 'O teu livro';
  $('edition').textContent = `ISBN ${book.isbn}`;
  saveLabel(); renderHistory(); renderManual();
}
function link(text, url) {
  const a = document.createElement('a'); a.textContent = text; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
}
function renderManual() {
  $('manual-results').replaceChildren();
  for (const store of CATALOGUE.filter(s => s.mode === 'manual')) {
    const row = document.createElement('div'); row.className = 'manual-row';
    const note = document.createElement('p'); note.className = 'muted'; note.textContent = store.reason;
    const query = store.group === 'used' || store.format ? current.title || current.isbn : current.isbn;
    row.append(link(store.name, searchUrl(store, query)), note); $('manual-results').append(row);
  }
}
function renderShops() {
  $('coverage').textContent = `Lojas: ${selected.size} de ${STORES.length} selecionadas`;
  $('shop-list').replaceChildren();
  for (const store of STORES) {
    const label = document.createElement('label'); label.className = 'shop-option';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(store.id); checkbox.value = store.id;
    checkbox.onchange = () => { checkbox.checked ? selected.add(store.id) : selected.delete(store.id); renderShops(); persist().catch(() => status('Não foi possível guardar a seleção.')); };
    label.append(checkbox, document.createTextNode(store.name)); $('shop-list').append(label);
  }
  $('references').replaceChildren();
  for (const store of CATALOGUE.filter(s => s.mode === 'reference')) {
    const p = document.createElement('p'); p.className = 'muted'; p.textContent = `${store.name}: ${store.reason}`; $('references').append(p);
  }
}
function renderSaved() {
  $('saved').replaceChildren();
  const entries = Object.values(saved); $('count').textContent = entries.length; $('empty').hidden = entries.length > 0;
  for (const book of entries) {
    const li = document.createElement('li'); const open = document.createElement('button'); open.textContent = book.title || book.isbn;
    open.onclick = () => { $('isbn').value = book.isbn; $('title-query').value = book.title || ''; start(book); };
    const remove = document.createElement('button'); remove.className = 'remove'; remove.textContent = 'Remover';
    remove.setAttribute('aria-label', `Remover ${book.title || book.isbn}`);
    remove.onclick = async () => {
      delete saved[book.isbn]; renderSaved(); saveLabel();
      try { await persist(); } catch { status('Não foi possível guardar a alteração. Tenta novamente.'); }
    };
    li.append(open, remove); $('saved').append(li);
  }
}
function renderHistory() {
  $('history').replaceChildren(); const points = history[current?.isbn] || [];
  if (!points.length) { $('history').textContent = 'Ainda não há preços registados para esta edição.'; return; }
  for (const store of STORES) {
    const groups = Map.groupBy(points.filter(p => p.store === store.id), p => `${p.currency || 'EUR'}/${p.condition || 'NewCondition'}`);
    for (const [group, values] of groups) {
      const [currency, condition] = group.split('/');
      const p = document.createElement('p'); const last = values.at(-1);
      p.textContent = `${store.name} (${currency}${condition === 'UsedCondition' ? ', usado' : ''}): mínimo ${money(Math.min(...values.map(v => v.price)), currency)} | ${new Date(last.at).toLocaleDateString('pt-PT')}`;
      $('history').append(p);
    }
  }
}
function renderOffers(offers) {
  $('results').replaceChildren(); $('unconfirmed-results').replaceChildren();
  const available = offers.filter(o => o.status === 'ok' && o.availability === 'InStock' && (o.currency || 'EUR') === 'EUR' && o.condition === 'NewCondition' && !o.marketplace);
  const best = available.length ? Math.min(...available.map(o => o.price)) : null;
  const ordered = [...offers].sort((a, b) => (a.currency || 'EUR').localeCompare(b.currency || 'EUR') || (a.price || Infinity) - (b.price || Infinity));
  const missing = offers.filter(o => o.status !== 'ok').length;
  $('unconfirmed-count').textContent = `${missing} lojas sem preço confirmado`; $('unconfirmed').hidden = missing === 0;
  for (const offer of ordered) {
    const row = document.createElement('div'); row.className = 'offer';
    const price = document.createElement('strong'); price.textContent = offer.status === 'ok' ? money(offer.price, offer.currency) : '…';
    const detail = document.createElement('small');
    const availability = { InStock: 'Em stock', OutOfStock: 'Sem stock', PreOrder: 'Pré-venda', BackOrder: 'Por encomenda', Discontinued: 'Descontinuado', SoldOut: 'Esgotado' };
    if (offer.status === 'ok') {
      const condition = offer.condition === 'UsedCondition' ? 'Usado' : offer.condition === 'NewCondition' ? 'Novo' : 'Estado por confirmar';
      detail.textContent = `${condition} · ${availability[offer.availability] || 'Disponibilidade por confirmar'}${offer.marketplace ? ` · vendedor: ${offer.seller || 'confirmar na loja'}` : ''}${offer.currency !== 'EUR' ? ' · sem conversão de moeda' : ''}`;
    } else detail.textContent = ({ loading: 'A consultar…', queued: 'A aguardar…', cancelled: 'Consulta interrompida.', denied: 'Acesso não autorizado. Abre a loja para consultar.' })[offer.status] || 'Preço não confirmado. Abre a loja para consultar.';
    row.append(link(offer.name, offer.url), price, detail);
    if (offer.price === best && available.includes(offer)) { row.classList.add('best'); const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = 'Menor preço novo em EUR, com stock confirmado'; row.append(badge); }
    $(offer.status === 'ok' ? 'results' : 'unconfirmed-results').append(row);
  }
}
async function start(book) {
  const isbn = isbn13(book.isbn);
  if (!isbn) { status('Introduz um ISBN-10 ou ISBN-13 válido. Encontras o número junto ao código de barras.'); $('isbn').focus(); return; }
  const stores = STORES.filter(s => selected.has(s.id));
  if (!stores.length) { status('Seleciona pelo menos uma loja para comparar.'); $('shops').open = true; return; }
  const permission = chrome.permissions.request({ origins: stores.map(s => `${s.origin}/*`) });
  controller?.abort(); controller = new AbortController(); const signal = controller.signal; const token = ++run;
  let knownTitle = book.title || saved[isbn]?.title || '';
  showBook({ isbn, title: knownTitle });
  const offers = stores.map(s => ({ ...s, status: 'queued', url: s.search(isbn) })); activeOffers = offers;
  renderOffers(offers); $('cancel').hidden = false;
  status(`A consultar ${stores.length} lojas, até quatro de cada vez. Mantém esta janela aberta.`);
  try {
    const granted = await permission;
    if (token !== run) return;
    if (!granted) { renderOffers(offers.map(o => ({ ...o, status: 'denied' }))); status('Acesso não autorizado. Podes consultar cada loja através das ligações.'); return; }
    let complete = 0;
    await pooled(stores, async (store, index) => {
      if (signal.aborted) return;
      offers[index].status = 'loading'; if (token === run) renderOffers(offers);
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(35000)]);
      offers[index] = await compareStore(store, isbn, deadline, undefined, knownTitle);
      if (!knownTitle && offers[index].title) knownTitle = offers[index].title;
      complete++;
      if (token === run) { renderOffers(offers); status(`${complete} de ${stores.length} lojas consultadas.`); }
    });
    if (token !== run) return;
    const found = offers.filter(o => o.status === 'ok'); showBook({ isbn, title: knownTitle });
    history = remember(history, isbn, found);
    if (saved[isbn] && knownTitle) saved[isbn] = { isbn, title: knownTitle };
    await persist(); if (token !== run) return;
    renderSaved(); renderHistory();
    status(found.length ? `${found.length} de ${stores.length} preços confirmados para esta edição. Portes não incluídos.` : 'Não foi possível confirmar preços. Experimenta indicar também o título, ou abre as lojas para consultar.');
  } catch { if (token === run) status('Não foi possível concluir a consulta ou guardar os dados. Tenta novamente.'); }
  finally { if (token === run) $('cancel').hidden = true; }
}
$('search').onsubmit = event => { event.preventDefault(); start({ isbn: $('isbn').value, title: $('title-query').value.trim() }); };
$('cancel').onclick = () => {
  ++run; controller?.abort(); $('cancel').hidden = true;
  renderOffers(activeOffers.map(o => ['queued', 'loading'].includes(o.status) ? { ...o, status: 'cancelled' } : o));
  status('Consulta interrompida. Os resultados parciais não foram guardados no histórico.');
};
$('select-all').onclick = () => { selected = new Set(STORES.map(s => s.id)); renderShops(); persist().catch(() => status('Não foi possível guardar a seleção.')); };
$('select-none').onclick = () => { selected.clear(); renderShops(); persist().catch(() => status('Não foi possível guardar a seleção.')); };
$('auto-toggle').onclick = async () => {
  try {
    if (!autoEnabled) {
      const stores = STORES.filter(s => selected.has(s.id));
      if (!stores.length) { status('Seleciona pelo menos uma loja para ativar os avisos.'); return; }
      if (!await chrome.permissions.request({ origins: stores.map(s => `${s.origin}/*`) })) { status('Acesso não autorizado. Os avisos continuam desativados.'); return; }
    }
    autoEnabled = !autoEnabled;
    await chrome.storage.local.set({ autoEnabled }); autoLabel();
    status(autoEnabled ? 'Avisos ativos nas lojas autorizadas e selecionadas. Abre um livro para procurar preços mais baixos.' : 'Avisos automáticos desativados.');
  } catch { status('Não foi possível alterar os avisos automáticos.'); }
};
$('save').onclick = async () => {
  if (!current) return;
  if (!saved[current.isbn] && Object.keys(saved).length >= 100) { status('A estante tem 100 livros. Remove um para guardar outro.'); return; }
  saved[current.isbn] = { ...current }; saveLabel(); renderSaved();
  try { await persist(); status('Livro guardado. Volta à estante para atualizar o preço.'); } catch { status('Não foi possível guardar este livro.'); }
};
$('clear').onclick = async () => {
  if (!confirm('Apagar a estante, o histórico e a seleção de lojas, e desativar os avisos automáticos?')) return;
  ++run; controller?.abort(); $('cancel').hidden = true; saved = {}; history = {}; selected = new Set(STORES.map(s => s.id));
  try { autoEnabled = false; await chrome.storage.local.set({ autoEnabled: false }); await persist(); autoLabel(); renderSaved(); renderHistory(); renderShops(); saveLabel(); status('Estante e histórico apagados.'); } catch { status('Não foi possível apagar os dados. Tenta novamente.'); }
};
async function init() {
  try {
    const data = await chrome.storage.local.get(['saved', 'history', 'selectedStores', 'autoEnabled']);
    autoEnabled = data.autoEnabled === true; autoLabel();
    saved = data.saved || {}; history = data.history || {};
    if (Array.isArray(data.selectedStores)) selected = new Set(data.selectedStores.filter(id => STORES.some(s => s.id === id)));
    renderSaved(); renderShops();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || '')) { status('Introduz um ISBN ou abre uma página de livro para começar.'); return; }
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => ({ html: document.documentElement.outerHTML.slice(0, 4_000_000) }) });
    const book = detectBook(new DOMParser().parseFromString(result.result.html, 'text/html'), tab.url);
    if (run) return;
    if (book.isbn) { $('isbn').value = book.isbn; $('title-query').value = book.title; showBook(book); status('Livro detetado. Clica em Comparar para consultar as livrarias.'); }
    else status('Não encontrei um ISBN único nesta página. Introduz o ISBN da edição que procuras.');
  } catch { renderShops(); status('Esta página não permite a leitura do livro. Podes introduzir o ISBN manualmente.'); }
}
init();
