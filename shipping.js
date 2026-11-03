export const REGIONS = {
  mainland: 'Portugal continental',
  madeira: 'Madeira',
  azores: 'Açores',
  other: 'Outro destino'
};
const verifiedAt = Date.parse('2026-11-03T00:00:00Z');
const expiresAt = verifiedAt + 30 * 86400000;
const wook = {
  source: 'https://www.wook.pt/Mensagem/index/?key=portes-gratis',
  verifiedAt,
  expiresAt,
  note: 'Standard, livros vendidos pela Wook, até 10 kg. Crédito em cartão não é portes grátis.'
};
const presenca = {
  source: 'https://www.presenca.pt/policies/shipping-policy',
  verifiedAt,
  expiresAt,
  note: 'Envio normal de um livro. Extras e expedições acima de 20 kg não incluídos.'
};
export const SHIPPING_DEFAULTS = {
  mainland: {
    wook: { ...wook, fee: null, freeFrom: 1600 },
    presenca: { ...presenca, fee: 300, freeFrom: 2001, unknownAt: [2000] }
  },
  madeira: { wook: { ...wook, fee: 0 }, presenca: { ...presenca, fee: 400 } },
  azores: { wook: { ...wook, fee: 0 }, presenca: { ...presenca, fee: 400 } }
};
export function shippingRule(store, settings = {}) {
  const region = settings.region || 'mainland';
  return settings.rules?.[region]?.[store] || SHIPPING_DEFAULTS[region]?.[store] || null;
}
const amount = n => Number.isSafeInteger(n) && n >= 0;
export function quoteDelivery(offer, settings = {}, now = Date.now()) {
  const unknown = {
    known: false,
    shipping: null,
    total: null,
    remaining: null,
    reason: 'Portes por confirmar'
  };
  if (offer.currency !== 'EUR' || offer.marketplace || !amount(offer.price)) {
    return unknown;
  }
  const rule = shippingRule(offer.id, settings);
  if (!rule) {
    return unknown;
  }
  const remaining = amount(rule.freeFrom) ? Math.max(0, rule.freeFrom - offer.price) : null;
  const promo = rule.promotion;
  // Future page detectors must supply an explicit region, validity and verified evidence.
  const activePromotion =
    promo?.verified === true &&
    promo.region === (settings.region || 'mainland') &&
    Number.isFinite(promo.startsAt) &&
    Number.isFinite(promo.endsAt) &&
    now >= promo.startsAt &&
    now < promo.endsAt &&
    amount(promo.minimum) &&
    offer.price >= promo.minimum;
  let shipping = null,
    reason = '';
  if (activePromotion) {
    shipping = 0;
    reason = 'Campanha de portes grátis';
  } else if (!Number.isFinite(rule.expiresAt) || now >= rule.expiresAt) {
    return { ...unknown, reason: 'Regra de portes expirada' };
  } else if (rule.unknownAt?.includes(offer.price)) {
    return { ...unknown, remaining };
  } else if (amount(rule.freeFrom) && offer.price >= rule.freeFrom) {
    shipping = 0;
    reason = 'Mínimo para portes grátis atingido';
  } else if (amount(rule.fee)) {
    shipping = rule.fee;
    reason = shipping === 0 ? 'Portes grátis' : 'Portes estimados';
  }
  if (shipping === null) {
    return { ...unknown, remaining };
  }
  return {
    known: true,
    shipping,
    total: offer.price + shipping,
    remaining,
    reason,
    source: rule.source || 'manual'
  };
}
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
export function targetOffer(offers, watch, shipping, now = Date.now()) {
  return (
    offers
      .filter(eligibleOffer)
      .map(o => {
        const delivery = quoteDelivery(o, shipping, now);
        return {
          ...o,
          delivery,
          targetPrice: watch.basis === 'delivered' ? delivery.total : o.price
        };
      })
      .filter(o => o.targetPrice !== null && o.targetPrice <= watch.target)
      .sort((a, b) => a.targetPrice - b.targetPrice)[0] || null
  );
}
