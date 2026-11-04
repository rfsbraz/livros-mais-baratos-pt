import { validPromotion, voucherExample, PROMOTION_TTL } from './promotions.js';
import { eligibleOffer } from './offers.js';
import { safeUrl } from './core.js';

export function comparisonValue(offer, enabled = true, now = Date.now()) {
  const useVoucher =
    enabled !== false &&
    offer.id === 'wook' &&
    eligibleOffer(offer) &&
    safeUrl(offer.url, 'https://www.wook.pt') &&
    validPromotion(offer.promotion, now) &&
    (!offer.promotion.maximumPurchase || offer.price <= offer.promotion.maximumPurchase);
  const percent = useVoucher ? voucherExample(offer.price, offer.promotion).savingPercent : 0;
  const price = useVoucher ? Math.ceil(offer.price * (1 - percent / 100) - 1e-9) : offer.price;
  return {
    price,
    cashPrice: offer.price,
    estimated: price < offer.price,
    validUntil: useVoucher
      ? Math.min(offer.promotion.endsAt, offer.promotion.verifiedAt + PROMOTION_TTL)
      : Infinity
  };
}

export function comparisonAlert(book, offers, sourceId, enabled = true, now = Date.now()) {
  const source = offers.find(o => o.id === sourceId && o.status === 'ok' && o.price === book.price);
  const current = comparisonValue(
    { ...book, id: sourceId, status: 'ok', promotion: source?.promotion },
    enabled,
    now
  );
  const candidates = offers
    .filter(o => o.id !== sourceId && eligibleOffer(o) && safeUrl(o.url, o.origin))
    .map(offer => ({ offer, value: comparisonValue(offer, enabled, now) }));
  const selected = candidates
    .filter(c => c.value.price < current.price)
    .sort((a, b) => a.value.price - b.value.price)[0];
  if (!selected) {
    return null;
  }
  const { offer: best, value } = selected;
  const price = value.price;
  const currentPrice = current.price;
  return {
    isbn: book.isbn,
    id: best.id,
    name: best.name,
    url: best.url,
    currency: best.currency,
    price,
    currentPrice,
    saving: currentPrice - price,
    basis: 'item',
    itemPrice: best.price,
    cashPrice: best.price,
    currentCashPrice: book.price,
    estimated: value.estimated || current.estimated,
    validUntil: Math.min(value.validUntil, current.validUntil),
    promotion: best.promotion,
    checkedAt: now
  };
}
