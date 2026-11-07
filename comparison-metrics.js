import { recordPoints, latencyBucket, storeResultPoint } from './metrics.js';
import { STORES } from './stores.js';

/** Recebe apenas ids fixos e estados, nunca o livro, preços ou endereços. */
export function comparisonMetrics({
  stores,
  surface = 'popup',
  trigger = 'page',
  openedAt,
  startedAt,
  now = () => performance.now(),
  record = recordPoints
}) {
  const start = startedAt ?? now();
  const opened = openedAt ?? start;
  const starts = new Map();
  const results = new Map();
  let firstPrice;
  let lastStore;
  let closed = false;
  const emit = points => {
    record(points).catch(() => {});
  };
  emit([
    { metric: 'compare_run', surface, outcome: trigger, count: 1 },
    ...STORES.filter(store => !stores.includes(store.id)).map(store =>
      storeResultPoint(surface, store.id, 'disabled', 0)
    )
  ]);
  return {
    start(id) {
      if (!closed) {
        starts.set(id, now());
      }
    },
    rendered(id, status) {
      if (closed || !stores.includes(id)) {
        return;
      }
      const at = now();
      results.set(id, storeResultPoint(surface, id, status, at - (starts.get(id) ?? start)));
      lastStore = id;
      if (status === 'ok' && firstPrice === undefined) {
        firstPrice = at;
      }
    },
    finish(outcome = 'settled') {
      if (closed) {
        return;
      }
      closed = true;
      const at = now();
      const points = stores.map(
        id =>
          results.get(id) ||
          storeResultPoint(
            surface,
            id,
            outcome === 'abandoned' ? 'cancelled' : 'error',
            at - (starts.get(id) ?? start)
          )
      );
      if (surface === 'popup') {
        if (firstPrice !== undefined || outcome === 'abandoned') {
          points.push({
            metric: 't_first_result',
            outcome,
            bucket: latencyBucket((outcome === 'abandoned' ? at : firstPrice) - opened),
            count: 1
          });
        }
        points.push(
          { metric: 't_all_settled', outcome, bucket: latencyBucket(at - opened), count: 1 },
          { metric: 't_compare_settled', outcome, bucket: latencyBucket(at - start), count: 1 }
        );
      }
      if (lastStore) {
        points.push({ metric: 'slowest_store', surface, store: lastStore, count: 1 });
      }
      emit(points);
    }
  };
}
