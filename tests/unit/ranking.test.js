import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { hasActiveReferral } from '../../stores.js';
import { setAffiliateLinksEnabled } from '../../affiliate.js';
import {
  rankOffers,
  rankPopupOffers,
  cheapestOffer,
  cheapestBannerOffer,
  showsCheapestBadge,
  targetOffer
} from '../../offers.js';
import { cheaperOffer } from '../../auto-rules.js';
import { comparisonAlert, comparisonValue } from '../../comparison-values.js';

const now = Date.parse('2026-11-12T12:00:00Z');
const origins = {
  wook: 'https://www.wook.pt',
  bertrand: 'https://www.bertrand.pt',
  mbooks: 'https://mbooks.pt',
  almedina: 'https://www.almedina.net',
  continente: 'https://www.continente.pt',
  porto: 'https://www.portoeditora.pt'
};
const names = {
  wook: 'Wook',
  bertrand: 'Bertrand',
  mbooks: 'mbooks',
  almedina: 'Almedina',
  continente: 'Continente',
  porto: 'Porto Editora'
};

function offer(id, price, extra = {}) {
  const origin = extra.origin || origins[id] || 'https://shop.example';
  return {
    id,
    name: names[id] || id,
    status: 'ok',
    price,
    currency: 'EUR',
    condition: 'NewCondition',
    availability: 'InStock',
    ...extra,
    origin,
    url: extra.url || `${origin}/livro/teste`
  };
}

const book = {
  isbn: '9780306406157',
  price: 2000,
  currency: 'EUR',
  condition: 'NewCondition',
  url: 'https://www.portoeditora.pt/produtos/ficha/teste'
};

test('tied eligible offers prefer the referral store in ranking and for the cheapest badge', () => {
  const continente = offer('continente', 1500);
  const bertrand = offer('bertrand', 1500);
  const ranked = rankPopupOffers([continente, bertrand]);
  assert.equal(ranked[0].id, 'bertrand');
  assert.equal(ranked[1].id, 'continente');
  assert.equal(showsCheapestBadge(bertrand, [continente, bertrand]), true);
  assert.equal(showsCheapestBadge(continente, [continente, bertrand]), false);
  assert.equal(cheapestBannerOffer([continente, bertrand]).id, 'bertrand');
});

test('ties between two referral stores or two non-referral stores keep input order', () => {
  const wook = offer('wook', 1500);
  const bertrand = offer('bertrand', 1500);
  const mbooks = offer('mbooks', 1500);
  assert.deepEqual(
    rankPopupOffers([wook, bertrand, mbooks]).map(o => o.id),
    ['wook', 'bertrand', 'mbooks']
  );
  assert.deepEqual(
    rankPopupOffers([mbooks, wook]).map(o => o.id),
    ['mbooks', 'wook']
  );
  assert.equal(showsCheapestBadge(wook, [wook, bertrand]), true);
  assert.equal(showsCheapestBadge(bertrand, [wook, bertrand]), true);
  assert.equal(targetOffer([wook, bertrand], { target: 1500 }).id, 'wook');
  assert.equal(targetOffer([bertrand, wook], { target: 1500 }).id, 'bertrand');
  assert.equal(cheaperOffer(book, [wook, bertrand], 'porto').id, 'wook');
  assert.equal(cheaperOffer(book, [bertrand, wook], 'porto').id, 'bertrand');
  assert.equal(comparisonAlert(book, [wook, bertrand], 'porto', false, now).id, 'wook');
  assert.equal(comparisonAlert(book, [bertrand, wook], 'porto', false, now).id, 'bertrand');

  const continente = offer('continente', 1500);
  const almedina = offer('almedina', 1500);
  assert.deepEqual(
    rankPopupOffers([continente, almedina]).map(o => o.id),
    ['continente', 'almedina']
  );
  assert.deepEqual(
    rankPopupOffers([almedina, continente]).map(o => o.id),
    ['almedina', 'continente']
  );
  assert.equal(showsCheapestBadge(continente, [continente, almedina]), true);
  assert.equal(showsCheapestBadge(almedina, [continente, almedina]), true);
  assert.equal(targetOffer([continente, almedina], { target: 1500 }).id, 'continente');
  assert.equal(cheaperOffer(book, [continente, almedina], 'porto').id, 'continente');
  assert.equal(comparisonAlert(book, [continente, almedina], 'porto', false, now).id, 'continente');
});

test('a non-referral offer cheaper by one cent still wins', () => {
  const continente = offer('continente', 1499);
  const bertrand = offer('bertrand', 1500);
  assert.equal(rankPopupOffers([bertrand, continente])[0].id, 'continente');
  assert.equal(showsCheapestBadge(continente, [bertrand, continente]), true);
  assert.equal(showsCheapestBadge(bertrand, [bertrand, continente]), false);
  assert.equal(cheapestBannerOffer([bertrand, continente]).id, 'continente');
  assert.equal(targetOffer([bertrand, continente], { target: 1500 }).id, 'continente');
  assert.equal(cheaperOffer(book, [bertrand, continente], 'porto').id, 'continente');
  assert.equal(comparisonAlert(book, [bertrand, continente], 'porto', false, now).id, 'continente');
  assert.equal(bertrand.price, 1500);
  assert.equal(continente.price, 1499);
});

test('the referral tie-break applies everywhere the cheapest offer is chosen', () => {
  const continente = offer('continente', 1500);
  const bertrand = offer('bertrand', 1500);
  const offers = [continente, bertrand];
  assert.equal(rankPopupOffers(offers)[0].id, 'bertrand', 'popup ranking');
  assert.equal(showsCheapestBadge(bertrand, offers), true, 'cheapest-new-in-stock badge');
  assert.equal(showsCheapestBadge(continente, offers), false, 'cheapest-new-in-stock badge');
  assert.equal(cheapestBannerOffer(offers).id, 'bertrand', 'cheapest-new-in-stock banner');
  assert.equal(targetOffer(offers, { target: 1500 }).id, 'bertrand', 'target alerts');
  assert.equal(cheaperOffer(book, offers, 'porto').id, 'bertrand', 'automatic alerts');
  assert.equal(
    comparisonAlert(book, offers, 'porto', false, now).id,
    'bertrand',
    'in-page comparison alerts'
  );
  const value = o => comparisonValue(o, false, now).price;
  assert.equal(cheapestOffer(offers, value).id, 'bertrand');
});

test('the referral flag comes from store config, not a hardcoded list in the sorter', () => {
  assert.equal(hasActiveReferral('wook'), true);
  assert.equal(hasActiveReferral('bertrand'), true);
  assert.equal(hasActiveReferral('mbooks'), true);
  assert.equal(hasActiveReferral('almedina'), false);
  assert.equal(hasActiveReferral('continente'), false);
  assert.equal(hasActiveReferral({ id: 'bertrand' }), true);
  const referral = offer('partner-shop', 1500, { origin: 'https://www.bertrand.pt' });
  const other = offer('other-shop', 1500, { origin: 'https://www.almedina.net' });
  assert.equal(hasActiveReferral(referral), true);
  assert.equal(hasActiveReferral(other), false);
  assert.equal(rankOffers([other, referral])[0].id, 'partner-shop');
  assert.equal(targetOffer([other, referral], { target: 1500 }).id, 'partner-shop');
  assert.equal(cheaperOffer(book, [other, referral], 'porto').id, 'partner-shop');
  assert.equal(comparisonAlert(book, [other, referral], 'porto', false, now).id, 'partner-shop');
});

afterEach(() => setAffiliateLinksEnabled(true));

test('with affiliate links off, an exact tie keeps the stable order', () => {
  const continente = offer('continente', 1500);
  const bertrand = offer('bertrand', 1500);
  setAffiliateLinksEnabled(false);
  assert.equal(hasActiveReferral('bertrand'), false);
  assert.equal(hasActiveReferral('wook'), false);
  assert.deepEqual(
    rankPopupOffers([continente, bertrand]).map(o => o.id),
    ['continente', 'bertrand']
  );
  assert.equal(showsCheapestBadge(continente, [continente, bertrand]), true);
  assert.equal(showsCheapestBadge(bertrand, [continente, bertrand]), true);
  assert.equal(cheapestBannerOffer([continente, bertrand]).id, 'continente');
  assert.equal(rankOffers([continente, bertrand])[0].id, 'continente', 'shared comparator');
  assert.equal(cheaperOffer(book, [continente, bertrand], 'porto').id, 'continente', 'auto-rules');
  assert.equal(targetOffer([continente, bertrand], { target: 1500 }).id, 'continente');
  assert.equal(comparisonAlert(book, [continente, bertrand], 'porto', false, now).id, 'continente');
});
