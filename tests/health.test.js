import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectOffer, failureCode } from '../scripts/health-check.mjs';
import { issueBody, syncIssue, marker } from '../scripts/report-store-health.mjs';
import { STORES } from '../extension/stores.js';

const healthy = () => ({ complete: true, results: STORES.map(s => ({ store: s.id, status: 'ok', attempts: [{ status: 'ok' }] })) });
test('health checks validate product paths and prices, allowing stock changes', () => {
  const store = STORES.find(s => s.id === 'wook');
  const offer = { status: 'ok', price: 1250, currency: 'EUR', availability: 'OutOfStock', url: store.origin + '/livro/example' };
  assert.equal(inspectOffer(store, offer), 'ok');
  assert.equal(inspectOffer(store, { ...offer, price: 0 }), 'invalid-offer');
  assert.equal(inspectOffer(store, { ...offer, currency: 'USD' }), 'invalid-offer');
  assert.equal(inspectOffer(store, { ...offer, url: store.origin + '/pesquisa' }), 'product-pattern');
  assert.equal(inspectOffer(store, { ...offer, url: 'https://evil.test/livro/x' }), 'product-pattern');
  assert.equal(inspectOffer(store, { status: 'unverified' }), 'pattern-unverified');
  assert.equal(failureCode('pattern-unverified', [{ status: 403 }]), 'access-blocked');
  assert.equal(failureCode('request-failed', [{ status: 503 }]), 'shop-server-error');
  assert.equal(failureCode('request-failed', [{ error: 'TimeoutError' }]), 'network-error');
  assert.equal(failureCode('pattern-unverified', [{ status: 404 }]), 'page-missing');
  assert.equal(failureCode('ok', [{ status: 403 }]), 'ok');
});
test('only a complete exact-store report can resolve an incident', () => {
  assert.equal(issueBody(healthy(), 'https://example.test/run').healthy, true);
  for (const report of [null, { complete: true, results: [] }, { ...healthy(), complete: false },
    { complete: true, results: [...healthy().results.slice(1), healthy().results[1]] }]) {
    assert.equal(issueBody(report, 'https://example.test/run').healthy, false);
  }
});
test('reporter creates, updates, closes and reopens one issue without duplicate comments', async () => {
  const records = [], issues = [];
  const github = { paginate: async () => issues, rest: { issues: {
    listForRepo() {},
    create: async p => { records.push(['create', p]); issues.push({ ...p, number: 42, user: { type: 'Bot' } }); },
    update: async p => { records.push(['update', p]); Object.assign(issues[0], p); }
  } } };
  const args = { github, repo: { owner: 'owner', repo: 'repo' }, runUrl: 'https://example.test/run' };
  await syncIssue({ ...args, report: healthy() });
  assert.equal(records.length, 0);
  const failed = healthy(); failed.results[0].status = 'access-blocked';
  await syncIssue({ ...args, report: failed });
  assert.equal(records.at(-1)[0], 'create');
  assert(issues[0].body.startsWith(marker));
  await syncIssue({ ...args, report: failed });
  assert.equal(records.at(-1)[0], 'update');
  assert.equal(issues.length, 1);
  await syncIssue({ ...args, report: null });
  assert.equal(issues[0].state, 'open');
  await syncIssue({ ...args, report: healthy() });
  assert.equal(issues[0].state, 'closed');
  await syncIssue({ ...args, report: failed });
  assert.equal(issues[0].state, 'open');
  assert.equal(issues.length, 1);
});
