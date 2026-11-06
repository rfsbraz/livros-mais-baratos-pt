import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparisonMetrics } from '../../comparison-metrics.js';

test('opening, click, rendered result and last finisher use their distinct clocks', () => {
  let clock = 1000;
  const points = [];
  const run = comparisonMetrics({
    stores: ['wook', 'bertrand'],
    openedAt: 0,
    startedAt: 1000,
    now: () => clock,
    record: async batch => points.push(...batch)
  });
  run.start('wook');
  clock = 2100; // Includes render cost before reporting the result.
  run.rendered('wook', 'ok');
  run.start('bertrand'); // A queued shop finishes last despite taking less time.
  clock = 2200;
  run.rendered('bertrand', 'blocked');
  run.finish();
  assert.equal(points.find(p => p.metric === 't_first_result').bucket, '3000');
  assert.equal(points.find(p => p.metric === 't_all_settled').bucket, '3000');
  assert.equal(points.find(p => p.metric === 't_compare_settled').bucket, '1500');
  assert.equal(points.find(p => p.metric === 'slowest_store').store, 'bertrand');
  assert.equal(
    points.find(p => p.metric === 'store_latency' && p.store === 'bertrand').bucket,
    '250'
  );
});

test('abandonment reports once and late results cannot create a second observation', () => {
  let clock = 0;
  const points = [];
  const run = comparisonMetrics({
    stores: ['wook'],
    now: () => clock,
    record: async batch => points.push(...batch)
  });
  run.start('wook');
  clock = 600;
  run.finish('abandoned');
  run.rendered('wook', 'ok');
  run.finish();
  assert.equal(points.filter(p => p.metric === 't_all_settled').length, 1);
  assert.equal(points.find(p => p.metric === 'store_latency').outcome, 'aborted');
  assert.equal(points.find(p => p.metric === 't_first_result').outcome, 'abandoned');
});

test('automatic and scheduled results retain their surface without popup latency totals', () => {
  for (const surface of ['auto', 'scheduled']) {
    const points = [];
    const run = comparisonMetrics({
      stores: ['wook'],
      surface,
      now: () => 10,
      record: async batch => points.push(...batch)
    });
    run.rendered('wook', 'timeout');
    run.finish();
    assert.equal(points.find(p => p.metric === 'store_latency').surface, surface);
    assert.equal(
      points.some(p => p.metric.startsWith('t_')),
      false
    );
  }
});

test('closing after a partial result marks all popup totals as abandoned at the elapsed time', () => {
  let clock = 0;
  const points = [];
  const run = comparisonMetrics({
    stores: ['wook', 'bertrand'],
    now: () => clock,
    record: async batch => points.push(...batch)
  });
  clock = 100;
  run.rendered('wook', 'ok');
  clock = 700;
  run.finish('abandoned');
  const totals = points.filter(point => point.metric.startsWith('t_'));
  assert.equal(totals.length, 3);
  assert.ok(totals.every(point => point.outcome === 'abandoned' && point.bucket === '1000'));
});
