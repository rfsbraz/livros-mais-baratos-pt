import { hasActiveReferral } from './stores.js';

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

export function compareByPriceThenReferral(
  a,
  b,
  priceOf = offer => offer.price,
  storeOf = offer => offer
) {
  const left = priceOf(a);
  const right = priceOf(b);
  const da = Number.isFinite(left) ? left : Infinity;
  const db = Number.isFinite(right) ? right : Infinity;
  return da - db || Number(hasActiveReferral(storeOf(b))) - Number(hasActiveReferral(storeOf(a)));
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

export function cheapestBannerLinkChanged(banner, candidate) {
  return (
    Number(banner.dataset.price) !== candidate.value.price ||
    banner.dataset.offer !== candidate.offer.id
  );
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
  const priced = offers.filter(o => Number.isFinite(priceOf(o)));
  if (!priced.length || price !== Math.min(...priced.map(priceOf))) {
    return false;
  }
  const tied = priced.filter(o => priceOf(o) === price);
  return !tied.some(hasActiveReferral) || hasActiveReferral(offer);
}

export function targetOffer(offers, watch) {
  const best = cheapestOffer(offers.filter(eligibleOffer).filter(o => o.price <= watch.target));
  return best ? { ...best, targetPrice: best.price } : null;
}
