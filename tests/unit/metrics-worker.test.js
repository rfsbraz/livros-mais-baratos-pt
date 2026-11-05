import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../../worker/index.js';
import { dataPoints, validBatch } from '../../worker/metrics-batch.js';
import { estimate } from '../../scripts/metrics-p95-without-store.mjs';
import { CATALOGUE } from '../../stores.js';

const schema = JSON.parse(readFileSync('tests/fixtures/metrics-schema.json', 'utf8'));
const CHROME = 'chrome-extension://ongoinfbkmfffpmnkinhnoepdclbkenc';
const ENDPOINT = 'https://metrics.example/v1/batch';
const latency = {
  metric: 'store_latency',
  surface: 'popup',
  store: 'wook',
  outcome: 'price',
  bucket: '1000',
  count: 3
};
const batch = (over = {}) => ({
  schema: 1,
  browser: 'chrome',
  version: '0.1.6',
  day: '2026-11-05',
  sample_rate: 1,
  points: [latency],
  ...over
});

function env({ allow = true } = {}) {
  const written = [];
  const keys = [];
  return {
    written,
    keys,
    METRICS: { writeDataPoint: point => written.push(point) },
    RATE_LIMITER: {
      limit: async ({ key }) => {
        keys.push(key);
        return { success: allow };
      }
    }
  };
}

function post(body, { origin = CHROME, type = 'application/json', headers = {} } = {}) {
  const all = { 'Content-Type': type, ...headers };
  if (origin) {
    all.Origin = origin;
  }
  return new Request(ENDPOINT, {
    method: 'POST',
    headers: all,
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

test('a valid batch writes the expected points and replies 204 with CORS and no cookie', async () => {
  const e = env();
  const res = await worker.fetch(post(batch()), e);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), CHROME);
  assert.equal(res.headers.get('Set-Cookie'), null);
  assert.deepEqual(e.written, [
    {
      indexes: ['store_latency'],
      blobs: ['store_latency', 'chrome', '0.1.6', 'popup', 'wook', 'price', '1000'],
      doubles: [3, 1, 1000]
    },
    {
      indexes: ['batch'],
      blobs: ['batch', 'chrome', '0.1.6', '', '', '', ''],
      doubles: [1, 1, 0]
    }
  ]);
});

test('the open bucket is stored with a number the percentile queries can use', () => {
  const [point] = dataPoints(batch({ points: [{ ...latency, bucket: 'inf' }] }));
  assert.equal(point.blobs[6], 'inf');
  assert.equal(point.doubles[2], 60000);
});

test('no written point holds the IP, the User-Agent or request.cf data', async () => {
  const e = env();
  const request = post(batch(), {
    headers: { 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'SecretAgent/1.0' }
  });
  request.cf = { country: 'PT', city: 'Lisboa', asn: 64500, timezone: 'Europe/Lisbon' };
  assert.equal((await worker.fetch(request, e)).status, 204);
  const stored = JSON.stringify(e.written);
  for (const secret of ['203.0.113.9', 'SecretAgent', '"PT"', 'Lisboa', '64500', 'Europe']) {
    assert(!stored.includes(secret), `${secret} reached the dataset`);
  }
  assert.deepEqual(e.keys, ['203.0.113.9'], 'the IP only reaches the in-memory limiter');
});

const rejected = {
  'an unknown batch field': batch({ installId: 'abc' }),
  'an unknown point field': batch({ points: [{ ...latency, isbn: 'x' }] }),
  'a dimension the metric does not have': batch({
    points: [{ metric: 'popup_open', store: 'wook', count: 1 }]
  }),
  'a missing dimension': batch({ points: [{ metric: 'store_active', count: 1 }] }),
  'an unknown metric': batch({ points: [{ metric: 'title', count: 1 }] }),
  'the server-only batch metric': batch({ points: [{ metric: 'batch', count: 1 }] }),
  'an inherited property as a metric': batch({ points: [{ metric: 'constructor', count: 1 }] }),
  'a store outside the list': batch({ points: [{ ...latency, store: 'lojinha' }] }),
  'an ISBN as a store': batch({ points: [{ ...latency, store: '9789722071550' }] }),
  'an ISBN as the version': batch({ version: '9789722071550' }),
  'a URL as the version': batch({ version: 'https://wook.pt/livro/1' }),
  'a URL as an outcome': batch({ points: [{ ...latency, outcome: 'https://wook.pt/' }] }),
  'a string over 32 characters': batch({ version: '1.'.repeat(20) + '1' }),
  'a negative count': batch({ points: [{ ...latency, count: -1 }] }),
  'a zero count': batch({ points: [{ ...latency, count: 0 }] }),
  'a huge count': batch({ points: [{ ...latency, count: 1000001 }] }),
  'a fractional count': batch({ points: [{ ...latency, count: 1.5 }] }),
  'a bucket outside the list': batch({ points: [{ ...latency, bucket: '999' }] }),
  'a timed outcome without a bucket': batch({
    points: [
      { metric: 'store_latency', surface: 'popup', store: 'wook', outcome: 'price', count: 1 }
    ]
  }),
  'an exact time for the day': batch({ day: '2026-11-05T10:15:00Z' }),
  'another schema version': batch({ schema: 2 }),
  'a sample rate of zero': batch({ sample_rate: 0 }),
  'a sample rate above one': batch({ sample_rate: 2 }),
  'no points': batch({ points: [] }),
  'a list as the batch': [batch()],
  'a null batch': null
};
for (const [name, body] of Object.entries(rejected)) {
  test(`rejects ${name} with 400 and writes nothing`, async () => {
    const e = env();
    assert.equal((await worker.fetch(post(JSON.stringify(body)), e)).status, 400);
    assert.deepEqual(e.written, []);
  });
}

test('rejects a __proto__ key, which JSON keeps as an own field', async () => {
  const e = env();
  const res = await worker.fetch(post('{"__proto__":{},"schema":1}'), e);
  assert.equal(res.status, 400);
  assert.deepEqual(e.written, []);
});

test('rejects broken JSON and the wrong content type with 400', async () => {
  const e = env();
  assert.equal((await worker.fetch(post('{nope'), e)).status, 400);
  assert.equal((await worker.fetch(post(batch(), { type: 'text/plain' }), e)).status, 400);
  assert.deepEqual(e.written, []);
});

test('a body over 32 KB gets 413, by header or by its real size', async () => {
  const e = env();
  const big = JSON.stringify(batch({ padding: 'x'.repeat(33000) }));
  assert.equal((await worker.fetch(post(big), e)).status, 413);
  const declared = post(batch(), { headers: { 'Content-Length': '40000' } });
  assert.equal((await worker.fetch(declared, e)).status, 413);
  assert.deepEqual(e.written, []);
});

test('more points than Analytics Engine takes in one request gets 413', async () => {
  const e = env();
  const fits = Array(schema.limits.maxPoints).fill({ metric: 'popup_open', count: 1 });
  const res = await worker.fetch(post(batch({ points: fits })), e);
  assert.equal(res.status, 204);
  assert.equal(e.written.length, 250, 'the batch point takes the last of the 250 writes');
  const over = env();
  const tooMany = [...fits, { metric: 'popup_open', count: 1 }];
  assert.equal((await worker.fetch(post(batch({ points: tooMany })), over)).status, 413);
  assert.deepEqual(over.written, []);
});

test('a batch is written whole or not at all', async () => {
  const e = env();
  const points = [latency, { ...latency, store: 'lojinha' }];
  assert.equal((await worker.fetch(post(batch({ points })), e)).status, 400);
  assert.deepEqual(e.written, []);
});

for (const origin of [
  'https://wook.pt',
  'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'moz-extension://not-a-uuid',
  'null',
  null
]) {
  test(`rejects the origin ${origin} without CORS headers`, async () => {
    const e = env();
    const res = await worker.fetch(post(batch(), { origin }), e);
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
    assert.deepEqual(e.written, []);
  });
}

for (const origin of [
  CHROME,
  'chrome-extension://hcielebbeilidlkedpobbclikllnmggn',
  'moz-extension://0f5c2d9e-4a6b-4c1d-8e7f-1a2b3c4d5e6f'
]) {
  test(`accepts the origin ${origin}, also on the preflight`, async () => {
    const e = env();
    assert.equal((await worker.fetch(post(batch(), { origin }), e)).status, 204);
    const preflight = new Request(ENDPOINT, { method: 'OPTIONS', headers: { Origin: origin } });
    const res = await worker.fetch(preflight, e);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(res.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  });
}

test('the rate limit replies 429 before reading the batch', async () => {
  const e = env({ allow: false });
  assert.equal((await worker.fetch(post(batch()), e)).status, 429);
  assert.deepEqual(e.written, []);
});

test('other methods get 400 and other paths 404', async () => {
  const e = env();
  const get = new Request(ENDPOINT, { headers: { Origin: CHROME } });
  assert.equal((await worker.fetch(get, e)).status, 400);
  const other = new Request('https://metrics.example/', {
    method: 'POST',
    headers: { Origin: CHROME }
  });
  assert.equal((await worker.fetch(other, e)).status, 404);
});

test('the Worker logs nothing and never reads request.cf', () => {
  for (const file of ['worker/index.js', 'worker/metrics-batch.js']) {
    const source = readFileSync(file, 'utf8');
    assert(!/\bconsole\./.test(source), `${file} logs`);
    assert(!/\.cf\b/.test(source), `${file} reads request.cf`);
  }
});

test('the Worker config keeps logs off and holds no secrets', () => {
  const config = readFileSync('worker/wrangler.toml', 'utf8').replaceAll('\r\n', '\n');
  assert.match(config, /^logpush = false$/m);
  assert.match(config, /\[observability\]\nenabled = false/);
  assert(!/tail_consumers|\[vars\]|token|secret\s*=|api_key/i.test(config));
});

test('the schema lists every store and every metric dimension resolves', () => {
  assert.deepEqual(
    schema.sets.stores,
    CATALOGUE.map(s => s.id)
  );
  assert.equal(schema.sets.storeCounts.length, CATALOGUE.length + 1);
  for (const dimensions of Object.values(schema.metrics)) {
    for (const set of Object.values(dimensions)) {
      assert(schema.sets[set], `${set} is not a set`);
    }
  }
  assert(validBatch(batch(), schema));
});

test('removing the slow store lowers the estimated p95, and only that one matters', () => {
  const rows = [
    { store: 'wook', bucket_ms: 1000, n: 100 },
    { store: 'bertrand', bucket_ms: 1000, n: 100 },
    { store: 'fnac', bucket_ms: 20000, n: 100 }
  ];
  const { p95_ms: all, stores } = estimate(rows);
  assert.equal(all, 20000);
  assert.deepEqual(stores[0], { store: 'fnac', p95_without_ms: 1000, saved_ms: 19000 });
  assert.equal(stores[1].saved_ms, 0);
});

test('a store used in few comparisons weighs less than a store used in all', () => {
  const rows = [
    { store: 'wook', bucket_ms: 1000, n: 1000 },
    { store: 'lello', bucket_ms: 20000, n: 10 }
  ];
  assert.equal(estimate(rows).p95_ms, 1000);
});
