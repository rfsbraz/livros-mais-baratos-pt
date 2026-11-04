import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVoucherTerms,
  validPromotion,
  voucherExample,
  promotionUrl,
  PROMOTION_TTL
} from '../../promotions.js';
const now = Date.parse('2026-11-04T12:00:00Z');
const url = 'https://www.wook.pt/Mensagem/index/?key=outro-nome';
export const terms = `Festa de leitura. Condições para encomendas registadas e pagas nos dias 4 e 5 de novembro de 2026, Portugal Continental.
O valor pago será devolvido sob a forma de vale de compras (VALE 100%), 15 dias após o envio da totalidade da encomenda.
O vale não é reembolsável em dinheiro. Validade do vale: 60 dias.
Utilização até ao limite de 50% do valor total da encomenda.`;
test('voucher conditions determine combined savings independently of campaign name', () => {
  const p = parseVoucherTerms(terms, url, now);
  assert(validPromotion(p, now));
  assert.deepEqual(voucherExample(1885, p), {
    credit: 1885,
    futureBasket: 3770,
    futurePayment: 1885,
    savingPercent: 100 / 3
  });
  const different = parseVoucherTerms(
    terms.replace('100%', '50%').replace('limite de 50%', 'limite de 25%'),
    url,
    now
  );
  assert.equal(different.refundPercent, 50);
  assert.equal(different.redemptionPercent, 25);
  assert.equal(voucherExample(2000, different).savingPercent, 100 / 6);
});
test('missing terms, expired or future campaigns and unsafe destinations never get estimates', () => {
  for (const text of [
    '100% de desconto',
    terms.replace('50%', '0%'),
    terms.replace('60 dias', 'indeterminada'),
    terms.replace('4 e 5', '31 e 32')
  ]) {
    assert.equal(parseVoucherTerms(text, url, now), null);
  }
  assert.equal(parseVoucherTerms(terms, url, Date.parse('2026-11-03T23:59:59Z')), null);
  assert.equal(parseVoucherTerms(terms, url, Date.parse('2026-11-06T00:00:00Z')), null);
  for (const raw of [
    'https://www.wook.pt.evil.test/Mensagem/index/?key=x',
    'javascript:alert(1)',
    'https://www.wook.pt/Mensagem/index/?key=x&action=buy',
    'https://user@www.wook.pt/Mensagem/index/?key=x'
  ]) {
    assert.equal(promotionUrl(raw), null);
  }
  const p = parseVoucherTerms(terms, url, now);
  assert(!validPromotion(p, now + PROMOTION_TTL));
  assert(!validPromotion({ ...p, verifiedAt: now + 1 }, now));
});
test('campaign dates use mainland Portugal summer time and exclusive end dates', () => {
  const summer = terms.replace('4 e 5 de novembro', '4 e 5 de julho');
  assert(parseVoucherTerms(summer, url, Date.parse('2026-07-03T23:00:00Z')));
  assert.equal(parseVoucherTerms(summer, url, Date.parse('2026-07-05T23:00:00Z')), null);
});
