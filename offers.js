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
export function targetOffer(offers, watch) {
  const best = offers
    .filter(eligibleOffer)
    .filter(o => o.price <= watch.target)
    .sort((a, b) => a.price - b.price)[0];
  return best ? { ...best, targetPrice: best.price } : null;
}
