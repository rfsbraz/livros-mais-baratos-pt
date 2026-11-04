import { safeUrl } from './core.js';

export const PROMOTION_TTL = 10 * 60_000;
const origin = 'https://www.wook.pt';
const fold = text =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export function promotionUrl(raw) {
  const safe = safeUrl(raw, origin);
  if (!safe) {
    return null;
  }
  const url = new URL(safe);
  if (!/^\/Mensagem\/index\/?$/i.test(url.pathname) || !url.searchParams.get('key')) {
    return null;
  }
  // Only keep the information-page identifier, never tracking or action parameters.
  return `${origin}${url.pathname}?${new URLSearchParams({ key: url.searchParams.get('key') })}`;
}

export function discoverPromotion(doc, url) {
  if (new URL(url).origin !== origin || !new URL(url).pathname.startsWith('/livro/')) {
    return null;
  }
  // Product purchase area, not recommendations, the homepage banner or the campaign name.
  const links = [...doc.querySelectorAll('.sale-container .wook-container > a[href]')];
  return links.map(a => promotionUrl(a.getAttribute('href'))).find(Boolean) || null;
}

const months = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
];
function midnight(year, month, day) {
  const utc = Date.UTC(year, month, day);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Lisbon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(utc)
      .map(p => [p.type, p.value])
  );
  const local = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second
  );
  return utc - (local - utc);
}

export function parseVoucherTerms(text, url, now = Date.now()) {
  url = promotionUrl(url);
  const t = fold(text);
  if (
    !url ||
    !/valor pago.{0,70}devolvid.{0,35}forma de vale/.test(t) ||
    !/nao.{0,8}reembolsavel em dinheiro/.test(t)
  ) {
    return null;
  }
  // Read the refund from the contractual sentence, not the marketing title.
  const refund = t.match(
    /valor pago.{0,70}devolvid.{0,35}forma de vale.{0,40}?vale\s+(\d+(?:[.,]\d+)?)\s*%/
  );
  const cap = t.match(/ate ao limite de\s+(\d+(?:[.,]\d+)?)\s*%\s+do valor total/);
  const period = t.match(
    /encomendas registadas e pagas nos? dias?\s+(\d{1,2})(?:\s*(?:e|a)\s*(\d{1,2}))?\s+de\s+(\w+)\s+de\s+(\d{4})/
  );
  const validity = t.match(/validade do vale\s*:\s*(\d+)\s+dias/);
  const delay = t.match(/(\d+)\s+dias apos o envio da totalidade da encomenda/);
  if (!refund || !cap || !period || !validity || !delay || !t.includes('portugal continental')) {
    return null;
  }
  const refundPercent = Number(refund[1].replace(',', '.')),
    redemptionPercent = Number(cap[1].replace(',', '.'));
  const first = +period[1],
    last = +(period[2] || period[1]),
    month = months.indexOf(period[3]),
    year = +period[4];
  if (
    month < 0 ||
    first < 1 ||
    last < first ||
    (period[2] && last - first > 1 && /\d\s+e\s+\d/.test(period[0])) ||
    last > new Date(Date.UTC(year, month + 1, 0)).getUTCDate() ||
    refundPercent <= 0 ||
    refundPercent > 100 ||
    redemptionPercent <= 0 ||
    redemptionPercent > 100
  ) {
    return null;
  }
  const startsAt = midnight(year, month, first),
    endsAt = midnight(year, month, last + 1);
  if (now < startsAt || now >= endsAt) {
    return null;
  }
  return {
    kind: 'future-voucher',
    url,
    refundPercent,
    redemptionPercent,
    startsAt,
    endsAt,
    verifiedAt: now,
    validDays: +validity[1],
    delayDays: +delay[1],
    maximumPurchase: (() => {
      const match = t.match(/encomendas de valor superior a (\d+(?:[.,]\d+)?)\s*€/);
      return match ? Math.round(Number(match[1].replace(',', '.')) * 100) : null;
    })()
  };
}

export function validPromotion(p, now = Date.now()) {
  return (
    p?.kind === 'future-voucher' &&
    promotionUrl(p.url) === p.url &&
    Number.isFinite(p.verifiedAt) &&
    p.verifiedAt <= now &&
    now - p.verifiedAt < PROMOTION_TTL &&
    Number.isFinite(p.startsAt) &&
    Number.isFinite(p.endsAt) &&
    p.startsAt <= now &&
    now < p.endsAt &&
    Number.isFinite(p.refundPercent) &&
    p.refundPercent > 0 &&
    p.refundPercent <= 100 &&
    Number.isFinite(p.redemptionPercent) &&
    p.redemptionPercent > 0 &&
    p.redemptionPercent <= 100 &&
    Number.isInteger(p.validDays) &&
    p.validDays > 0 &&
    Number.isInteger(p.delayDays) &&
    p.delayDays >= 0
  );
}

export function voucherExample(price, p) {
  const credit = Math.floor((price * p.refundPercent) / 100);
  const futureBasket = Math.ceil((credit * 100) / p.redemptionPercent);
  return {
    credit,
    futureBasket,
    futurePayment: futureBasket - credit,
    savingPercent: (100 * credit) / (price + futureBasket)
  };
}

const termsCache = new Map();
export async function enrichPromotion(offer, loader, signal, now = Date.now()) {
  if (!offer?.promotionUrl || !promotionUrl(offer.promotionUrl)) {
    return offer;
  }
  const url = offer.promotionUrl;
  let entry = termsCache.get(url);
  if (!entry || now - entry.at >= PROMOTION_TTL) {
    const promise = (async () => {
      try {
        const doc = await loader(url, signal);
        if (promotionUrl(doc.shopUrl || url) !== url) {
          return null;
        }
        const parts = [];
        const walker = doc.createTreeWalker(doc.body, 4, {
          acceptNode: n =>
            n.parentElement?.closest('script,style,nav,header,footer,svg,template') ? 2 : 1
        });
        while (walker.nextNode()) {
          parts.push(walker.currentNode.textContent);
        }
        return parseVoucherTerms(parts.join(' '), url, now);
      } catch {
        return null;
      }
    })();
    entry = { at: now, promise };
    termsCache.set(url, entry);
    while (termsCache.size > 20) {
      termsCache.delete(termsCache.keys().next().value);
    }
  }
  const promotion = await entry.promise;
  return validPromotion(promotion, now) &&
    (!promotion.maximumPurchase || offer.price <= promotion.maximumPurchase)
    ? { ...offer, promotion }
    : offer;
}
