import { selectedStoreIds } from './stores.js';
import { bindAffiliateLink } from './affiliate.js';
import { detectBook, parseOffer, structured } from './parser.js';
import { storeForUrl } from './stores.js';
import { validCurrent } from './auto-rules.js';

export function start() {
  let stopped = false, timer, key = '', generation = 0, host, lastUrl = location.href;
  let affiliateEnabled = false;
  const dismissed = new Set();
  const money = n => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n / 100);
  function remove() { host?.remove(); host = null; }
  function show(result, book) {
    remove();
    host = document.createElement('div'); host.id = 'lmb-price-alert';
    host.style.cssText = 'all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483647;width:min(360px,calc(100vw - 40px));';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = ':host{font-family:system-ui,sans-serif}section{background:#fff;color:#172e59;border:1px solid #ccd7e9;border-top:4px solid #16624a;border-radius:10px;padding:20px;box-shadow:0 8px 36px #172e5933;font:14px/1.5 system-ui,sans-serif}h2{font-size:18px;margin:8px 24px 8px 0}p{margin:8px 0}small{display:block;color:#536278;font-size:11px}a{display:block;background:#2458bb;color:white;text-align:center;padding:10px;border-radius:5px;text-decoration:none;font-weight:600;margin:14px 0}button{float:right;border:0;background:transparent;color:#536278;cursor:pointer;font-size:20px}a:focus-visible,button:focus-visible{outline:3px solid #de9a1b;outline-offset:3px}.brand{font-size:11px;font-weight:700;letter-spacing:.5px;color:#536278}';
    const panel = document.createElement('section'); panel.setAttribute('role', 'status'); panel.setAttribute('aria-live', 'polite');
    const close = document.createElement('button'); close.textContent = '×'; close.setAttribute('aria-label', 'Fechar aviso'); close.onclick = () => { dismissed.add(book.isbn); remove(); };
    const brand = document.createElement('div'); brand.className = 'brand'; brand.textContent = 'LIVROS MAIS BARATOS PT';
    const title = document.createElement('h2'); title.textContent = `Poupa ${money(result.saving)} neste livro`;
    const detail = document.createElement('p'); detail.textContent = `${result.name}: ${money(result.price)} · Nesta loja: ${money(result.currentPrice ?? book.price)}`;
    const edition = document.createElement('small'); edition.textContent = `Mesma edição · ISBN ${book.isbn} · Novo, em stock`;
    const link = document.createElement('a'); link.textContent = `Ver oferta na ${result.name}`; link.href = result.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    bindAffiliateLink(link, () => affiliateEnabled, true);
    const note = document.createElement('small'); note.textContent = `${result.basis === 'delivered' ? 'Total estimado com portes. ' : 'Preço do livro; portes por confirmar. '}Consulta às ${new Date(result.checkedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}. Confirma o preço na loja.`;
    const disclosure = document.createElement('small');
    disclosure.textContent = new URL(result.url).hostname === 'www.wook.pt' && affiliateEnabled ? 'Ligação de afiliado: podemos receber uma comissão ao clicares. Podes desativar na extensão.' : '';
    panel.append(close, brand, title, detail, edition, link, disclosure, note); shadow.append(style, panel); document.documentElement.append(host);
  }
  async function scan() {
    if (stopped) return;
    const url = location.href, store = storeForUrl(url);
    const data = await chrome.storage.local.get(['autoEnabled', 'selectedStores', 'affiliateEnabled']);
    if (stopped || location.href !== url) return;
    affiliateEnabled = data.affiliateEnabled !== false;
    if (data.autoEnabled === false || !selectedStoreIds(data.selectedStores).includes(store?.id)) { remove(); key = ''; generation++; return; }
    let book = null;
    if (store && !store.marketplace && store.product.test(location.pathname) && !/ebook|e-book|audiobook|audiolivro/i.test(location.pathname)) {
      const detected = detectBook(document, url);
      const digital = structured(document).some(n => /EBook|AudioBook/i.test(String(n.bookFormat || '')));
      if (detected.isbn && !digital) book = { ...detected, ...parseOffer(document, detected.isbn, url) };
    }
    const next = book && validCurrent(book, url) ? `${url}/${book.isbn}/${book.price}` : '';
    if (next === key) return;
    key = next; const token = ++generation; remove();
    if (!next || dismissed.has(book.isbn)) return;
    try {
      const result = await chrome.runtime.sendMessage({ target: 'background', type: 'compare-page', url, book });
      if (stopped || token !== generation || location.href !== url) return;
      if (result?.busy) { key = ''; clearTimeout(timer); timer = setTimeout(() => { timer = null; scan().catch(() => {}); }, 30_000); return; }
      if (result?.isbn === book.isbn && result.saving > 0 && !dismissed.has(book.isbn)) show(result, book);
    } catch { /* Access may have been revoked or the extension reloaded. */ }
  }
  function schedule() { if (!timer) timer = setTimeout(() => { timer = null; scan().catch(() => {}); }, 1500); }
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['content'] });
  const interval = setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; key = ''; generation++; remove(); schedule(); } }, 1000);
  function changed(changes, area) {
    if (area !== 'local' || (!changes.autoEnabled && !changes.selectedStores && !changes.affiliateEnabled && !changes.shipping)) return;
    if (changes.affiliateEnabled) affiliateEnabled = changes.affiliateEnabled.newValue !== false;
    generation++; key = ''; remove(); schedule();
  }
  chrome.storage.onChanged.addListener(changed);
  const refreshed = message => { if (message?.type === 'auto-config-changed') { generation++; key = ''; remove(); schedule(); } };
  chrome.runtime.onMessage.addListener(refreshed);
  const restored = event => { if (event.persisted && stopped) { window.removeEventListener('pageshow', restored); globalThis.lmbStarting = true; start(); } };
  window.addEventListener('pageshow', restored);
  window.addEventListener('pagehide', () => { stopped = true; generation++; observer.disconnect(); clearTimeout(timer); clearInterval(interval); remove(); chrome.storage.onChanged.removeListener(changed); chrome.runtime.onMessage.removeListener(refreshed); globalThis.lmbStarting = false; }, { once: true });
  scan().catch(() => {});
}
