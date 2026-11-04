import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparisonValue, comparisonAlert } from '../../comparison-values.js';
import { targetOffer } from '../../shipping.js';
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
const shipping = {
  region: 'mainland',
  rules: {
    mainland: {
      wook: { fee: 300, freeFrom: 2000, expiresAt: now + 86400000 },
      continente: { fee: 0, expiresAt: now + 86400000 }
    }
  }
};
test('Wook voucher equivalent wins against a cheaper cash offer in another shop', () => {
  const alert = comparisonAlert(current, [wook], 'continente', shipping, true, now);
  assert.equal(alert.price, 1334);
  assert.equal(alert.cashPrice, 2000);
  assert.equal(alert.saving, 466);
  assert.equal(alert.currentCashPrice, 1800);
  assert.equal(alert.estimated, true);
  assert.equal(alert.validUntil, now + 600000);
  assert.equal(alert.basis, 'delivered');
  assert.equal(wook.price, 2000);
  assert.equal(comparisonAlert(current, [wook], 'continente', shipping, false, now), null);
});
test('shipping thresholds and target prices still use cash rather than voucher equivalent', () => {
  const value = comparisonValue(wook, shipping, true, now);
  assert.equal(value.delivery.shipping, 0);
  assert.equal(value.total, 1334);
  assert.equal(value.delivery.total, 2000);
  assert.equal(targetOffer([wook], { basis: 'item', target: 1500 }, shipping, now), null);
  const paidShipping = {
    region: 'other',
    rules: { other: { wook: { fee: 300, expiresAt: now + 86400000 } } }
  };
  assert.equal(comparisonValue(wook, paidShipping, true, now).total, 1634);
});
test('disabled, expired, old, missing, ineligible and foreign promotions never affect prices', () => {
  assert.equal(comparisonValue(wook, shipping, false, now).price, 2000);
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
    assert.equal(comparisonValue(offer, shipping, true, now).price, 2000);
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
    comparisonAlert(
      { ...current, price: 2000, url: wook.url },
      [wook, rival],
      'wook',
      shipping,
      true,
      now
    ),
    null
  );
  assert.equal(
    comparisonAlert(
      { ...current, price: 2100, url: wook.url },
      [wook, rival],
      'wook',
      shipping,
      true,
      now
    ).saving,
    300
  );
  assert.equal(
    comparisonAlert(
      { ...current, price: 2000, url: wook.url },
      [wook, rival],
      'wook',
      shipping,
      false,
      now
    ).saving,
    200
  );
});
test('unknown shipping keeps the estimated comparison on an item basis', () => {
  const result = comparisonAlert(current, [wook], 'continente', { region: 'other' }, true, now);
  assert.equal(result.basis, 'item');
  assert.equal(result.price, 1334);
  assert.equal(result.cashPrice, 2000);
});
