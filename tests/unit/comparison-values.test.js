import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparisonValue, comparisonAlert } from '../../comparison-values.js';
import { targetOffer } from '../../offers.js';
const now = Date.parse('2026-11-04T12:00:00Z');
const promotion = {
  kind: 'future-voucher',
  url: 'https://www.wook.pt/Mensagem/index/?key=leitura',
  refundPercent: 100,
  redemptionPercent: 50,
  startsAt: now - 1000,
  endsAt: now + 86400000,
  verifiedAt: now,
  validDays: 60,
  delayDays: 15
};
const wook = {
  id: 'wook',
  name: 'Wook',
  origin: 'https://www.wook.pt',
  url: 'https://www.wook.pt/livro/exemplo/123',
  status: 'ok',
  price: 2000,
  currency: 'EUR',
  condition: 'NewCondition',
  availability: 'InStock',
  promotion
};
const current = {
  isbn: '9780306406157',
  price: 1800,
  currency: 'EUR',
  condition: 'NewCondition',
  availability: 'InStock'
};
test('Wook voucher equivalent wins against a cheaper cash offer in another shop', () => {
  const alert = comparisonAlert(current, [wook], 'continente', true, now);
  assert.equal(alert.price, 1334);
  assert.equal(alert.cashPrice, 2000);
  assert.equal(alert.saving, 466);
  assert.equal(alert.currentCashPrice, 1800);
  assert.equal(alert.estimated, true);
  assert.equal(alert.validUntil, now + 600000);
  assert.equal(alert.basis, 'item');
  assert.equal(wook.price, 2000);
  assert.equal(comparisonAlert(current, [wook], 'continente', false, now), null);
});
test('targets retain cash prices rather than voucher equivalents', () => {
  assert.equal(comparisonValue(wook, true, now).price, 1334);
  assert.equal(targetOffer([wook], { target: 1500 }), null);
});
test('disabled, expired, old, missing, ineligible and foreign promotions never affect prices', () => {
  assert.equal(comparisonValue(wook, false, now).price, 2000);
  for (const offer of [
    { ...wook, promotion: null },
    { ...wook, promotion: { ...promotion, endsAt: now } },
    { ...wook, promotion: { ...promotion, verifiedAt: now - 600000 } },
    { ...wook, id: 'continente' },
    { ...wook, availability: 'OutOfStock' },
    { ...wook, marketplace: true },
    { ...wook, url: 'https://evil.example/livro/test' },
    { ...wook, promotion: { ...promotion, maximumPurchase: 1000 } }
  ]) {
    assert.equal(comparisonValue(offer, true, now).price, 2000);
  }
});
test('the current Wook page gets the same valuation only for its confirmed cash price', () => {
  const rival = {
    ...wook,
    id: 'continente',
    name: 'Continente',
    origin: 'https://www.continente.pt',
    url: 'https://www.continente.pt/produto/exemplo',
    price: 1800,
    promotion: undefined
  };
  assert.equal(
    comparisonAlert({ ...current, price: 2000, url: wook.url }, [wook, rival], 'wook', true, now),
    null
  );
  assert.equal(
    comparisonAlert({ ...current, price: 2100, url: wook.url }, [wook, rival], 'wook', true, now)
      .saving,
    300
  );
  assert.equal(
    comparisonAlert({ ...current, price: 2000, url: wook.url }, [wook, rival], 'wook', false, now)
      .saving,
    200
  );
});
