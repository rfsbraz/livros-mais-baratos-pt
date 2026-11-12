export function eligibleOffer(o) {
  return (
    o.status === 'ok' &&
    o.currency === 'EUR' &&
    o.condition === 'NewCondition' &&
    o.availability === 'InStock' &&
    !o.marketplace &&
    Number.isSafeInteger(o.price) &&
    o.price > 0
  );
}

export function compareByPriceThenReferral(a, b, priceOf = offer => offer.price) {
  const left = priceOf(a);
  const right = priceOf(b);
  const da = Number.isFinite(left) ? left : Infinity;
  const db = Number.isFinite(right) ? right : Infinity;
  return da - db;
}

export function rankOffers(offers, priceOf = offer => offer.price) {
  return [...offers].sort((a, b) => compareByPriceThenReferral(a, b, priceOf));
}

export function rankPopupOffers(offers, priceOf = offer => offer.price) {
  return [...offers].sort(
    (a, b) =>
      (a.currency || 'EUR').localeCompare(b.currency || 'EUR') ||
      compareByPriceThenReferral(a, b, o => {
        const price = priceOf(o);
        return price == null ? Infinity : price;
      }) ||
      (a.price || Infinity) - (b.price || Infinity)
  );
}

export function cheapestOffer(offers, priceOf = offer => offer.price) {
  return rankOffers(offers, priceOf)[0];
}

export function cheapestBannerOffer(offers, priceOf = offer => offer.price) {
  return cheapestOffer(
    offers.filter(eligibleOffer).filter(o => Number.isFinite(priceOf(o))),
    priceOf
  );
}

export function showsCheapestBadge(offer, offers, priceOf = o => o.price) {
  const price = priceOf(offer);
  if (!Number.isFinite(price)) {
    return false;
  }
  const prices = offers.map(priceOf).filter(Number.isFinite);
  return prices.length > 0 && price === Math.min(...prices);
}

export function targetOffer(offers, watch) {
  const best = offers
    .filter(eligibleOffer)
    .filter(o => o.price <= watch.target)
    .sort((a, b) => a.price - b.price)[0];
  return best ? { ...best, targetPrice: best.price } : null;
}
