import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectOffer, failureCode, retryAfterUntil, canRetry } from '../scripts/health-check.mjs';
import { issueBody, syncIssue, marker, readFailures } from '../scripts/report-store-health.mjs';
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
  assert.equal(failureCode('pattern-unverified', [{ status: 403 }]), 'access-forbidden');
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

test('daily schedule spreads every store exactly once over 24 hours', async () => {
  const { dailySchedule, selectedStores } = await import('../scripts/health-schedule.mjs');
  const schedule = dailySchedule();
  assert.equal(schedule.length, STORES.length);
  assert.equal(new Set(schedule.map(s => s.store)).size, STORES.length);
  for (let hour = 0; hour < 24; hour++) {
    const selected = selectedStores([], new Date(Date.UTC(2026, 10, 4, hour)));
    assert(selected.length >= 1 && selected.length <= 2);
    assert.deepEqual(selected, selectedStores(['--hourly'], new Date(Date.UTC(2026, 10, 5, hour))));
  }
  assert.throws(() => selectedStores(['typo']));
  assert.equal(selectedStores(['--all']).length, STORES.length);
  assert.deepEqual(selectedStores(['wook', 'wook']), ['wook']);
});
test('rate limits and access denials stop retries; Retry-After supports seconds and dates', () => {
  const now = Date.parse('2026-11-03T00:00:00Z');
  assert.equal(retryAfterUntil('3600', now), now + 3600000);
  assert.equal(retryAfterUntil('Wed, 04 Nov 2026 00:00:00 GMT', now), now + 86400000);
  assert.equal(retryAfterUntil('invalid', now), null);
  assert.equal(retryAfterUntil('0', now), null);
  assert.equal(failureCode('request-failed', [{ status: 429 }]), 'rate-limited');
  assert.equal(failureCode('request-failed', [{ status: 401 }]), 'authentication-required');
  assert.equal(failureCode('request-failed', [{ status: 405 }]), 'method-not-allowed');
  for (const status of ['rate-limited', 'access-forbidden', 'authentication-required', 'method-not-allowed']) {
    assert.equal(canRetry(status, []), false);
  }
  assert.equal(canRetry('shop-server-error', [{ retryAfterUntil: Date.now() + 3600000 }]), false);
  assert.equal(canRetry('network-error', []), true);
});
test('hourly reports retain unchecked failures and migrate the original tracking issue', () => {
  const old = marker + '\n| Wook | 9789895701124 | access-blocked | 2 |\n| Bertrand | 9789895701124 | access-blocked | 2 |';
  const one = (store, status) => ({ complete: true, plannedStores: [store], results: [{ store, status }] });
  const first = issueBody(one('wook', 'ok'), 'https://example.test/run', old);
  assert.equal(first.healthy, false);
  assert.deepEqual(Object.keys(readFailures(first.body)), ['bertrand']);
  const incomplete = issueBody({ ...one('bertrand', 'ok'), complete: false }, 'https://example.test/run', first.body);
  assert.equal(incomplete.healthy, false);
  assert.deepEqual(Object.keys(readFailures(incomplete.body)), ['bertrand']);
  const deferred = issueBody(one('bertrand', 'deferred'), 'https://example.test/run', first.body);
  assert.equal(deferred.healthy, false);
  assert.deepEqual(Object.keys(readFailures(deferred.body)), ['bertrand']);
  assert.equal(issueBody(one('bertrand', 'ok'), 'https://example.test/run', first.body).healthy, true);
});
