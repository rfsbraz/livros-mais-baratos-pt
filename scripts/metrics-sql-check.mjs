#!/usr/bin/env node
// Runs every query in docs/metrics.md against synthetic batches written through the real Worker,
// in ClickHouse under Docker. Analytics Engine has no local runner, so this checks the logic of the
// queries, not Analytics Engine itself. Needs Docker: npm run test:metrics-sql
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const IMAGE = 'clickhouse/clickhouse-server:25.8';
const CHROME = 'chrome-extension://ongoinfbkmfffpmnkinhnoepdclbkenc';

/** The sql blocks of the doc, by the id on their first line. */
export function readQueries(doc) {
  const queries = new Map();
  for (const [, id, sql] of doc.matchAll(/```sql\r?\n-- (\w+)\r?\n([\s\S]*?)```/g)) {
    queries.set(id, sql.trim());
  }
  return queries;
}

const bucketed = (metric, outcome, counts) =>
  Object.entries(counts).map(([bucket, count]) => ({ metric, outcome, bucket, count }));
const latency = (store, outcome, counts) =>
  Object.entries(counts).map(([bucket, count]) => ({
    metric: 'store_latency',
    surface: 'popup',
    store,
    outcome,
    bucket,
    count
  }));

/** Two chrome batches on 0.1.6, one firefox batch on 0.1.5 at a 50% sample. */
function batches() {
  const base = { schema: 1, day: '2026-11-05', sample_rate: 1 };
  const shared = [
    ...bucketed('t_first_result', 'settled', { 500: 90, 1000: 10 }),
    ...bucketed('t_all_settled', 'settled', { 3000: 80, 8000: 20 }),
    ...bucketed('t_all_settled', 'abandoned', { 1000: 25 }),
    ...latency('wook', 'price', { 500: 96, 1000: 4 }),
    ...latency('fnac', 'price', { 1000: 60 }),
    ...latency('fnac', 'timeout', { 20000: 30 }),
    ...latency('fnac', 'blocked', { 250: 10 }),
    ...latency('fnac', 'aborted', { inf: 500 }),
    { metric: 'slowest_store', surface: 'popup', store: 'fnac', count: 70 },
    { metric: 'slowest_store', surface: 'popup', store: 'wook', count: 30 },
    { metric: 'active_stores', bucket: '6', count: 1 },
    { metric: 'store_active', store: 'wook', count: 1 },
    { metric: 'affiliate_click', surface: 'popup_offer', count: 4 },
    { metric: 'wook_click_no_affiliate', surface: 'banner', count: 2 },
    { metric: 'popup_open', count: 40 },
    { metric: 'banner_shown', count: 10 },
    { metric: 'banner_closed', count: 3 }
  ];
  return [
    {
      ...base,
      browser: 'chrome',
      version: '0.1.6',
      points: [...shared, { metric: 'affiliate_setting', outcome: 'enabled', count: 1 }]
    },
    {
      ...base,
      browser: 'chrome',
      version: '0.1.6',
      points: [
        { metric: 'store_active', store: 'fnac', count: 1 },
        { metric: 'affiliate_setting', outcome: 'enabled', count: 1 }
      ]
    },
    {
      ...base,
      browser: 'firefox',
      version: '0.1.5',
      sample_rate: 0.5,
      points: [
        ...bucketed('t_first_result', 'settled', { 8000: 10 }),
        { metric: 'affiliate_setting', outcome: 'disabled', count: 1 }
      ]
    }
  ];
}

async function writeThroughWorker() {
  const { default: worker } = await import('../worker/index.js');
  const written = [];
  const env = { METRICS: { writeDataPoint: point => written.push(point) } };
  for (const batch of batches()) {
    const request = new Request('https://metrics.example/v1/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: CHROME },
      body: JSON.stringify(batch)
    });
    assert.equal((await worker.fetch(request, env)).status, 204);
  }
  return written;
}

function tableScript(points) {
  const blobs = [1, 2, 3, 4, 5, 6, 7].map(n => `blob${n} String`).join(', ');
  const rows = points.map(({ indexes, blobs: b, doubles: d }) => {
    const text = [indexes[0], ...b].map(value => `'${value}'`).join(', ');
    return `(now(), 1, ${text}, ${d.join(', ')})`;
  });
  return [
    `CREATE TABLE livros_metrics (timestamp DateTime, _sample_interval UInt32, index1 String, ${blobs}, double1 Float64, double2 Float64, double3 Float64) ENGINE = Memory;`,
    `INSERT INTO livros_metrics VALUES ${rows.join(', ')};`
  ].join('\n');
}

function run(setup, sql) {
  const output = execFileSync('docker', ['run', '--rm', '-i', IMAGE, 'clickhouse-local', '-n'], {
    input: `${setup}\n${sql};\n`,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  return JSON.parse(output).data;
}

const close = (actual, expected, name) =>
  assert(Math.abs(Number(actual) - expected) < 1e-6, `${name}: ${actual} is not ${expected}`);

const checks = {
  q1(rows) {
    const row = (metric, browser) => rows.find(r => r.metric === metric && r.browser === browser);
    assert.equal(row('t_first_result', 'chrome').p50_ms, 500);
    assert.equal(row('t_first_result', 'chrome').p95_ms, 1000);
    assert.equal(row('t_all_settled', 'chrome').p50_ms, 3000);
    assert.equal(row('t_all_settled', 'chrome').p95_ms, 8000);
    assert.equal(row('t_first_result', 'firefox').p50_ms, 8000);
    assert.equal(row('t_first_result', 'firefox').version, '0.1.5');
  },
  q2(rows) {
    const fnac = rows.find(r => r.store === 'fnac');
    assert.equal(rows[0].store, 'fnac', 'the slowest p95 comes first');
    assert.equal(fnac.p50_ms, 1000);
    assert.equal(fnac.p95_ms, 20000, 'the aborted requests stay out');
    close(fnac.timeout_rate, 0.3, 'timeout_rate');
    close(fnac.blocked_rate, 0.1, 'blocked_rate');
    close(fnac.error_rate, 0, 'error_rate');
  },
  q3a(rows) {
    assert.equal(rows[0].store, 'fnac');
    close(rows[0].last_finishes, 70, 'last_finishes');
  },
  async q3b(rows) {
    const { estimate } = await import('./metrics-p95-without-store.mjs');
    const result = estimate(rows);
    assert.equal(result.p95_ms, 20000);
    assert.equal(result.stores[0].store, 'fnac');
    assert.equal(result.stores[0].p95_without_ms, 500);
  },
  q4a(rows) {
    assert.equal(rows.length, 1);
    assert.equal(rows[0].active_stores, '6');
    close(rows[0].batches, 1, 'batches');
  },
  q4b(rows) {
    const n = (metric, store) => rows.find(r => r.metric === metric && r.store === store)?.n;
    close(n('batch', ''), 3 + 1, 'batch total, with the firefox batch weighted by its 50% sample');
    close(n('store_active', 'wook'), 1, 'wook');
    close(n('store_active', 'fnac'), 1, 'fnac');
  },
  q5a(rows) {
    close(rows[0].affiliate_enabled_share, 0.5, 'enabled share, by weighted batches');
  },
  q5b(rows) {
    close(rows.find(r => r.metric === 'affiliate_click').clicks, 4, 'affiliate_click');
    close(rows.find(r => r.metric === 'wook_click_no_affiliate').clicks, 2, 'no_affiliate');
  },
  q6a(rows) {
    const n = metric => rows.find(r => r.metric === metric).n;
    close(n('popup_open'), 40, 'popup_open');
    close(n('banner_shown'), 10, 'banner_shown');
    close(n('banner_closed'), 3, 'banner_closed');
  },
  q6b(rows) {
    close(rows[0].abandoned_rate, 0.2, 'abandoned_rate');
  },
  q7(rows) {
    const n = version => rows.find(r => r.version === version).batches;
    close(n('0.1.6'), 2, 'batches on 0.1.6');
    close(n('0.1.5'), 2, 'batches on 0.1.5, weighted by the 50% sample');
  }
};

async function main() {
  const setup = tableScript(await writeThroughWorker());
  const queries = readQueries(readFileSync('docs/metrics.md', 'utf8'));
  assert.deepEqual([...queries.keys()], Object.keys(checks));
  for (const [id, sql] of queries) {
    await checks[id](run(setup, sql));
    console.log(`ok ${id}`);
  }
  const month = run(setup, queries.get('q1').replace("'7'", "'30'"));
  checks.q1(month);
  console.log('ok q1 over 30 days');
  console.log(`All ${queries.size + 1} queries match the synthetic data.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
