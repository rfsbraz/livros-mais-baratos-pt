import { validPromotion, voucherExample, PROMOTION_TTL } from './promotions.js';
import { bindAffiliateLink } from './affiliate.js';

export function promotionCard(offer, enabled, now = Date.now()) {
  const p = offer?.promotion;
  if (
    offer?.id !== 'wook' ||
    offer.status !== 'ok' ||
    offer.currency !== 'EUR' ||
    !Number.isSafeInteger(offer.price) ||
    offer.price <= 0 ||
    !validPromotion(p, now)
  ) {
    return null;
  }
  const money = n =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n / 100);
  const example = voucherExample(offer.price, p);
  const box = document.createElement('aside');
  box.className = 'voucher-promotion';
  const title = document.createElement('strong');
  title.textContent = `${p.refundPercent}% em vale Wook: cerca de ${example.savingPercent.toLocaleString('pt-PT', { maximumFractionDigits: 1 })}% de poupança combinada`;
  const explanation = document.createElement('p');
  explanation.textContent = `Pagas ${money(offer.price)} agora e recebes ${money(example.credit)} em vale. Para o gastar integralmente, precisas de compras futuras elegíveis de pelo menos ${money(example.futureBasket)} (mais ${money(example.futurePayment)} a pagar). Não é desconto imediato; o preço comparado mantém-se.`;
  const terms = document.createElement('p');
  terms.textContent = `Estimativa sem portes, usando todo o vale, que cobre até ${p.redemptionPercent}% de cada compra futura. Emitido ${p.delayDays} dias após o envio completo; válido por ${p.validDays} dias. Sujeito às exclusões e condições da loja.`;
  const link = document.createElement('a');
  link.textContent = 'Saber mais';
  link.href = p.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  bindAffiliateLink(link, enabled, true);
  const disclosure = document.createElement('small');
  disclosure.textContent = enabled() ? 'Ligação de afiliado. Podes desativar em Definições.' : '';
  box.append(title, explanation, terms, link, disclosure);
  setTimeout(() => box.remove(), Math.min(p.endsAt, p.verifiedAt + PROMOTION_TTL) - now);
  return box;
}
