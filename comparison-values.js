import { validPromotion, voucherExample, PROMOTION_TTL } from './promotions.js';
import { quoteDelivery, eligibleOffer } from './shipping.js';
import { safeUrl } from './core.js';

export function comparisonValue(offer, shipping = {}, enabled = true, now = Date.now()) {
  const delivery = quoteDelivery(offer, shipping, now);
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
      : Infinity,
    delivery,
    total: delivery.known ? price + delivery.shipping : null
  };
}

export function comparisonAlert(
  book,
  offers,
  sourceId,
  shipping = {},
  enabled = true,
  now = Date.now()
) {
  const source = offers.find(o => o.id === sourceId && o.status === 'ok' && o.price === book.price);
  const current = comparisonValue(
    { ...book, id: sourceId, status: 'ok', promotion: source?.promotion },
    shipping,
    enabled,
    now
  );
  const candidates = offers
    .filter(o => o.id !== sourceId && eligibleOffer(o) && safeUrl(o.url, o.origin))
    .map(offer => ({ offer, value: comparisonValue(offer, shipping, enabled, now) }));
  let selected,
    basis = 'item';
  if (current.delivery.known) {
    selected = candidates
      .filter(c => c.value.total !== null && c.value.total < current.total)
      .sort((a, b) => a.value.total - b.value.total)[0];
    if (selected) {
      basis = 'delivered';
    } else {
      selected = candidates
        .filter(c => !c.value.delivery.known && c.value.price < current.price)
        .sort((a, b) => a.value.price - b.value.price)[0];
    }
  } else {
    selected = candidates
      .filter(c => c.value.price < current.price)
      .sort((a, b) => a.value.price - b.value.price)[0];
  }
  if (!selected) {
    return null;
  }
  const { offer: best, value } = selected;
  const price = basis === 'delivered' ? value.total : value.price;
  const currentPrice = basis === 'delivered' ? current.total : current.price;
  return {
    isbn: book.isbn,
    id: best.id,
    name: best.name,
    url: best.url,
    currency: best.currency,
    price,
    currentPrice,
    saving: currentPrice - price,
    basis,
    itemPrice: best.price,
    cashPrice: basis === 'delivered' ? value.delivery.total : best.price,
    currentCashPrice: basis === 'delivered' ? current.delivery.total : book.price,
    estimated: value.estimated || current.estimated,
    validUntil: Math.min(value.validUntil, current.validUntil),
    promotion: best.promotion,
    checkedAt: now
  };
}
