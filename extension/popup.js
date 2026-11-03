import { STORES, isbn13, remember } from './core.js';
import { detectBook } from './parser.js';
import { compareStore } from './compare.js';

const $ = id => document.getElementById(id);
const money = cents => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
let current = null;
let saved = {};
let history = {};
let controller = null;
let run = 0;
let writes = Promise.resolve();
const status = text => { $('status').textContent = text; };
function persist() {
  const snapshot = structuredClone({ saved, history });
  writes = writes.catch(() => {}).then(() => chrome.storage.local.set(snapshot));
  return writes;
}
function saveLabel() { $('save').textContent = saved[current?.isbn] ? 'Guardado' : 'Guardar'; }
function showBook(book) {
  current = book;
  $('book').hidden = false;
  $('title').textContent = book.title || 'O teu livro';
  $('edition').textContent = `ISBN ${book.isbn}`;
  saveLabel();
  renderHistory();
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
    open.onclick = () => { $('isbn').value = book.isbn; start(book); };
    const remove = document.createElement('button');
    remove.className = 'remove'; remove.textContent = 'Remover';
    remove.setAttribute('aria-label', `Remover ${book.title || book.isbn}`);
    remove.onclick = async () => {
      delete saved[book.isbn]; renderSaved(); saveLabel();
      try { await persist(); } catch { status('Não foi possível guardar a alteração. Tenta novamente.'); }
    };
    li.append(open, remove); $('saved').append(li);
  }
}
function renderHistory() {
  $('history').replaceChildren();
  const points = history[current?.isbn] || [];
  if (!points.length) { $('history').textContent = 'Ainda não há preços registados para esta edição.'; return; }
  for (const store of STORES) {
    const values = points.filter(p => p.store === store.id);
    if (!values.length) continue;
    const p = document.createElement('p');
    const last = values.at(-1);
    p.textContent = `${store.name}: mínimo ${money(Math.min(...values.map(v => v.price)))} | última consulta ${new Date(last.at).toLocaleDateString('pt-PT')}`;
    $('history').append(p);
  }
}
function renderOffers(offers) {
  $('results').replaceChildren();
  const available = offers.filter(o => o.status === 'ok' && o.availability === 'InStock');
  const best = available.length ? Math.min(...available.map(o => o.price)) : null;
  const ordered = [...offers].sort((a, b) => (a.status === 'ok' ? a.price : Infinity) - (b.status === 'ok' ? b.price : Infinity));
  for (const offer of ordered) {
    const row = document.createElement('div'); row.className = 'offer';
    const link = document.createElement('a'); link.textContent = offer.name; link.href = offer.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const price = document.createElement('strong'); price.textContent = offer.status === 'ok' ? money(offer.price) : '…';
    const detail = document.createElement('small');
    const availability = { InStock: 'Em stock', OutOfStock: 'Sem stock', PreOrder: 'Pré-venda', BackOrder: 'Por encomenda', Discontinued: 'Descontinuado', SoldOut: 'Esgotado' };
    detail.textContent = offer.status === 'ok' ? `${availability[offer.availability] || 'Disponibilidade por confirmar'} · consulta agora` : offer.status === 'loading' ? 'A consultar…' : offer.status === 'denied' ? 'Autoriza o acesso para comparar, ou abre a loja.' : 'Preço não confirmado. Abre a loja para consultar.';
    row.append(link, price, detail);
    if (offer.price === best && offer.availability === 'InStock') {
      row.classList.add('best'); const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = 'Menor preço confirmado em stock'; row.append(badge);
    }
    $('results').append(row);
  }
}
async function start(book) {
  const isbn = isbn13(book.isbn);
  if (!isbn) { status('Introduz um ISBN-10 ou ISBN-13 válido. Encontras o número junto ao código de barras.'); $('isbn').focus(); return; }
  // Request immediately inside the user's click, before any awaited work.
  const permission = chrome.permissions.request({ origins: STORES.map(s => `${s.origin}/*`) });
  controller?.abort(); controller = new AbortController();
  const signal = controller.signal;
  const token = ++run;
  showBook({ isbn, title: book.title || saved[isbn]?.title || '' });
  const offers = STORES.map(s => ({ ...s, status: 'loading', url: s.search(isbn) }));
  renderOffers(offers); status('A consultar quatro livrarias. Podes manter esta janela aberta até terminar.');
  try {
    const granted = await permission;
    if (token !== run) return;
    if (!granted) { renderOffers(offers.map(o => ({ ...o, status: 'denied' }))); status('Acesso não autorizado. Podes consultar cada loja através das ligações.'); return; }
    await Promise.all(STORES.map(async (store, index) => {
      offers[index] = await compareStore(store, isbn, signal);
      if (token === run) renderOffers(offers);
    }));
    if (token !== run) return;
    const found = offers.filter(o => o.status === 'ok');
    const title = book.title || found.find(o => o.title)?.title || saved[isbn]?.title || '';
    showBook({ isbn, title });
    history = remember(history, isbn, found);
    if (saved[isbn] && title) saved[isbn] = { isbn, title };
    await persist();
    if (token !== run) return;
    renderSaved(); renderHistory();
    status(found.length ? `${found.length} de 4 preços confirmados para esta edição. Portes não incluídos.` : 'Não foi possível confirmar preços. As lojas podem bloquear consultas automáticas. Abre as ligações para comparar.');
  } catch { if (token === run) status('Não foi possível concluir a consulta ou guardar os dados. Tenta novamente.'); }
}
$('search').onsubmit = event => { event.preventDefault(); const isbn = isbn13($('isbn').value); start({ isbn: $('isbn').value, title: current?.isbn === isbn ? current.title : '' }); };
$('save').onclick = async () => {
  if (!current) return;
  if (!saved[current.isbn] && Object.keys(saved).length >= 100) { status('A estante tem 100 livros. Remove um para guardar outro.'); return; }
  saved[current.isbn] = { ...current }; saveLabel(); renderSaved();
  try { await persist(); status('Livro guardado. Volta à estante para atualizar o preço.'); } catch { status('Não foi possível guardar este livro.'); }
};
$('clear').onclick = async () => {
  if (!confirm('Apagar a estante e todo o histórico guardado neste navegador?')) return;
  ++run; controller?.abort(); saved = {}; history = {};
  try { await persist(); renderSaved(); renderHistory(); saveLabel(); status('Estante e histórico apagados.'); } catch { status('Não foi possível apagar os dados. Tenta novamente.'); }
};
async function init() {
  try {
    const data = await chrome.storage.local.get(['saved', 'history']);
    saved = data.saved || {}; history = data.history || {}; renderSaved();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || '')) { status('Introduz um ISBN ou abre uma página de livro para começar.'); return; }
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => ({ html: document.documentElement.outerHTML.slice(0, 4_000_000) }) });
    const book = detectBook(new DOMParser().parseFromString(result.result.html, 'text/html'), tab.url);
    if (run) return;
    if (book.isbn) { $('isbn').value = book.isbn; showBook(book); status('Livro detetado. Clica em Comparar para consultar as livrarias.'); }
    else status('Não encontrei um ISBN único nesta página. Introduz o ISBN da edição que procuras.');
  } catch { status('Esta página não permite a leitura do livro. Podes introduzir o ISBN manualmente.'); }
}
init();
