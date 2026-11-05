#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const TARGET = 0.95;
const sum = values => values.reduce((a, b) => a + b, 0);

function storeCurves(rows) {
  const stores = new Map();
  for (const { store, bucket_ms: bucket, n } of rows) {
    const counts = stores.get(store) ?? new Map();
    counts.set(Number(bucket), Number(n));
    stores.set(store, counts);
  }
  const busiest = Math.max(...[...stores.values()].map(counts => sum([...counts.values()])));
  const curves = new Map();
  for (const [store, counts] of stores) {
    const total = sum([...counts.values()]);
    const share = total / busiest;
    curves.set(store, bucket => {
      const done = sum([...counts].map(([upTo, n]) => (upTo <= bucket ? n : 0)));
      return 1 - share + (share * done) / total;
    });
  }
  return curves;
}

function p95(curves, buckets, without) {
  for (const bucket of buckets) {
    let settled = 1;
    for (const [store, curve] of curves) {
      settled *= store === without ? 1 : curve(bucket);
    }
    if (settled >= TARGET) {
      return bucket;
    }
  }
  return buckets.at(-1);
}

/**
 * Estimates the p95 of a comparison's total time from per-store histograms (query q3b), with and
 * without each store. A comparison waits for all its stores, so the chance it is done by a given
 * time is the product of each store's chance, taken as independent. A store used in fewer
 * comparisons counts in proportion. Queueing is ignored, so read this as a ranking, not a measure.
 */
export function estimate(rows) {
  const curves = storeCurves(rows);
  const buckets = [...new Set(rows.map(row => Number(row.bucket_ms)))].sort((a, b) => a - b);
  const all = p95(curves, buckets);
  const stores = [...curves.keys()].map(store => {
    const without = p95(curves, buckets, store);
    return { store, p95_without_ms: without, saved_ms: all - without };
  });
  return { p95_ms: all, stores: stores.sort((a, b) => b.saved_ms - a.saved_ms) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { data } = JSON.parse(readFileSync(0, 'utf8'));
  console.log(JSON.stringify(estimate(data), null, 2));
}
