import { METRICS_ENDPOINT } from './metrics-config.js';
import { selectedStoreIds } from './stores.js';
import schema from './metrics-schema.json' with { type: 'json' };

export { METRICS_ENDPOINT };
export const METRICS_ALARM = 'metrics-flush';
export const PENDING_KEY = 'metricsPending';
export const ENABLED_KEY = 'metricsEnabled';
export const RETRY_KEY = 'metricsRetry';
export const LAST_SENT_KEY = 'metricsLastSentAt';
export const MAX_PENDING_BYTES = schema.limits.maxBodyBytes;
export const SAMPLE_RATE = 1;

const STORE_IDS = new Set(schema.sets.stores);
const BUCKET_MS = schema.sets.buckets.map(b => (b === 'inf' ? Infinity : Number(b)));
const ISBN_RE = /97[89]\d{10}/;
const HTTP_RE = /https?:/i;

export function detectBrowser(ua = globalThis.navigator?.userAgent || '') {
  if (/Edg\//.test(ua)) {
    return 'edge';
  }
  if (/Firefox\//.test(ua)) {
    return 'firefox';
  }
  return 'chrome';
}

export function defaultMetricsEnabled(browser = detectBrowser()) {
  return browser !== 'firefox';
}

export function latencyBucket(ms) {
  const value = Number.isFinite(ms) && ms >= 0 ? ms : Infinity;
  for (const edge of BUCKET_MS) {
    if (value <= edge) {
      return edge === Infinity ? 'inf' : String(edge);
    }
  }
  return 'inf';
}

export function storeCountBucket(count) {
  const n = Math.max(0, Math.min(60, Number(count) || 0));
  return String(n);
}

/** Map a compare offer status to a metrics outcome. */
export function outcomeFromStatus(status) {
  switch (status) {
    case 'ok':
      return 'price';
    case 'unverified':
    case 'unavailable':
      return 'no_price';
    case 'blocked':
    case 'denied':
    case 'access-blocked':
      return 'blocked';
    case 'timeout':
      return 'timeout';
    case 'cancelled':
      return 'aborted';
    case 'error':
      return 'error';
    case 'cached':
      return 'cached';
    case 'disabled':
      return 'disabled';
    default:
      return 'error';
  }
}

function pointKey(point) {
  return [
    point.metric,
    point.surface || '',
    point.store || '',
    point.outcome || '',
    point.bucket || ''
  ].join('\0');
}

function emptyPending() {
  return { points: Object.create(null) };
}

function clonePending(pending) {
  return { points: { ...(pending?.points || {}) } };
}

export function mergePoint(pending, point, count = 1) {
  const next = clonePending(pending);
  if (!point?.metric || !schema.metrics[point.metric]) {
    return next;
  }
  const dims = schema.metrics[point.metric];
  const normalized = { metric: point.metric };
  for (const name of ['surface', 'store', 'outcome', 'bucket']) {
    if (dims[name]) {
      const value = point[name];
      if (!schema.sets[dims[name]].includes(value)) {
        return next;
      }
      normalized[name] = value;
    } else if (point[name] != null) {
      return next;
    }
  }
  if (normalized.store && !STORE_IDS.has(normalized.store)) {
    return next;
  }
  const key = pointKey(normalized);
  const prev = next.points[key];
  const total = (prev?.count || 0) + Math.max(1, Math.floor(count));
  next.points[key] = { ...normalized, count: Math.min(schema.limits.maxCount, total) };
  return next;
}

export function pendingBytes(pending) {
  return new TextEncoder().encode(JSON.stringify(pendingToPoints(pending))).length;
}

export function pendingToPoints(pending) {
  return Object.values(pending?.points || {}).filter(p => p.count > 0);
}

export function trimPending(pending, limit = MAX_PENDING_BYTES) {
  const next = clonePending(pending);
  while (pendingBytes(next) > limit && Object.keys(next.points).length) {
    const oldest = Object.keys(next.points)[0];
    delete next.points[oldest];
  }
  return next;
}

export function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function buildBatch(
  pending,
  { browser, version, day = utcDay(), sample_rate = SAMPLE_RATE }
) {
  const points = pendingToPoints(pending).slice(0, schema.limits.maxPoints);
  return {
    schema: schema.schema,
    browser,
    version,
    day,
    sample_rate,
    points
  };
}

/** Reject batches that leak content or exceed whitelist rules before send. */
export function clientBatchSafe(batch) {
  const text = JSON.stringify(batch);
  if (text.length > schema.limits.maxBodyBytes) {
    return false;
  }
  if (ISBN_RE.test(text) || HTTP_RE.test(text)) {
    return false;
  }
  for (const point of batch.points || []) {
    for (const value of Object.values(point)) {
      if (typeof value === 'string' && value.length > schema.limits.maxStringLength) {
        return false;
      }
    }
  }
  return true;
}

export async function readMetricsState() {
  const data = await chrome.storage.local.get([
    PENDING_KEY,
    ENABLED_KEY,
    RETRY_KEY,
    LAST_SENT_KEY,
    'selectedStores',
    'autoEnabled',
    'wookPromotionEnabled',
    'affiliateEnabled'
  ]);
  const browser = detectBrowser();
  const enabled =
    data[ENABLED_KEY] === undefined ? defaultMetricsEnabled(browser) : data[ENABLED_KEY] === true;
  return {
    browser,
    enabled,
    pending:
      data[PENDING_KEY] && typeof data[PENDING_KEY] === 'object'
        ? data[PENDING_KEY]
        : emptyPending(),
    retry: data[RETRY_KEY] || null,
    lastSentAt: data[LAST_SENT_KEY] || 0,
    selectedStores: data.selectedStores,
    autoEnabled: data.autoEnabled !== false,
    wookPromotionEnabled: data.wookPromotionEnabled !== false,
    affiliateEnabled: data.affiliateEnabled !== false
  };
}

export async function firefoxCollectionAllowed() {
  if (detectBrowser() !== 'firefox') {
    return true;
  }
  // Optional AMO data-collection permission; absent API means rely on metricsEnabled only.
  const permissions = chrome.runtime?.getDataCollectionPermissions;
  if (typeof permissions !== 'function') {
    return true;
  }
  try {
    const granted = await permissions();
    return Boolean(
      granted?.optional?.includes?.('technicalAndInteraction') ||
      granted?.optionalPermissions?.includes?.('technicalAndInteraction')
    );
  } catch {
    return false;
  }
}

export async function clearPending() {
  await chrome.storage.local.remove([PENDING_KEY, RETRY_KEY]);
}

export async function setMetricsEnabled(enabled) {
  if (!enabled) {
    await chrome.storage.local.set({ [ENABLED_KEY]: false });
    await clearPending();
    await chrome.alarms.clear(METRICS_ALARM);
    return;
  }
  await chrome.storage.local.set({ [ENABLED_KEY]: true });
  await scheduleFlush();
}

export async function recordPoints(points) {
  if (!points?.length) {
    return;
  }
  const state = await readMetricsState();
  if (!state.enabled || !(await firefoxCollectionAllowed())) {
    return;
  }
  let pending = state.pending;
  for (const point of points) {
    pending = mergePoint(pending, point);
  }
  pending = trimPending(pending);
  await chrome.storage.local.set({ [PENDING_KEY]: pending });
}

export function configSnapshotPoints({
  selectedIds,
  autoEnabled,
  wookPromotionEnabled,
  affiliateEnabled
}) {
  const ids = [...new Set(selectedIds)].filter(id => STORE_IDS.has(id));
  const points = [
    { metric: 'active_stores', bucket: storeCountBucket(ids.length), count: 1 },
    {
      metric: 'auto_enabled',
      outcome: autoEnabled ? 'enabled' : 'disabled',
      count: 1
    },
    {
      metric: 'wook_promotion_enabled',
      outcome: wookPromotionEnabled ? 'enabled' : 'disabled',
      count: 1
    },
    {
      metric: 'affiliate_setting',
      outcome: affiliateEnabled ? 'enabled' : 'disabled',
      count: 1
    }
  ];
  for (const id of ids) {
    points.push({ metric: 'store_active', store: id, count: 1 });
  }
  return points;
}

export function storeResultPoint(surface, storeId, status, elapsedMs) {
  const outcome = outcomeFromStatus(status);
  if (outcome === 'disabled' || outcome === 'cached') {
    return {
      metric: 'store_untimed',
      surface,
      store: storeId,
      outcome,
      count: 1
    };
  }
  return {
    metric: 'store_latency',
    surface,
    store: storeId,
    outcome,
    bucket: latencyBucket(elapsedMs),
    count: 1
  };
}

async function jitteredDelayMinutes() {
  // Once per 24h with 0–6h jitter, expressed as minutes for chrome.alarms.
  return 24 * 60 + Math.floor(Math.random() * 6 * 60);
}

export async function scheduleFlush(delayMinutes) {
  const minutes = delayMinutes ?? (await jitteredDelayMinutes());
  await chrome.alarms.create(METRICS_ALARM, { delayInMinutes: Math.max(1, minutes) });
}

export async function ensureMetricsAlarm() {
  const state = await readMetricsState();
  if (!state.enabled) {
    await chrome.alarms.clear(METRICS_ALARM);
    return;
  }
  const existing = await chrome.alarms.get(METRICS_ALARM);
  if (!existing) {
    const due = state.retry?.nextAt
      ? Math.max(1, Math.ceil((state.retry.nextAt - Date.now()) / 60000))
      : await jitteredDelayMinutes();
    await scheduleFlush(due);
  }
}

const RETRY_DELAYS_MS = [60 * 60 * 1000, 6 * 60 * 60 * 1000, 24 * 60 * 60 * 1000];

export async function flushMetrics({
  now = Date.now(),
  fetchImpl = globalThis.fetch.bind(globalThis),
  version = chrome.runtime.getManifest().version,
  force = false
} = {}) {
  const state = await readMetricsState();
  if (!state.enabled || !(await firefoxCollectionAllowed())) {
    return { sent: false, reason: 'disabled' };
  }
  const points = pendingToPoints(state.pending);
  if (!points.length) {
    return { sent: false, reason: 'empty' };
  }
  const dayMs = 24 * 60 * 60 * 1000;
  if (!force && state.lastSentAt && now - state.lastSentAt < dayMs - 60_000) {
    if (!state.retry) {
      return { sent: false, reason: 'rate' };
    }
  }
  if (state.retry?.nextAt && now < state.retry.nextAt && !force) {
    return { sent: false, reason: 'backoff' };
  }

  const snapshot = configSnapshotPoints({
    selectedIds: selectedStoreIds(state.selectedStores),
    autoEnabled: state.autoEnabled,
    wookPromotionEnabled: state.wookPromotionEnabled,
    affiliateEnabled: state.affiliateEnabled
  });
  let pending = state.pending;
  for (const point of snapshot) {
    pending = mergePoint(pending, point);
  }
  const batch = buildBatch(pending, { browser: state.browser, version, day: utcDay(now) });
  if (!clientBatchSafe(batch) || batch.points.length === 0) {
    await clearPending();
    return { sent: false, reason: 'unsafe' };
  }

  let response;
  try {
    response = await fetchImpl(METRICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      credentials: 'omit',
      cache: 'no-store',
      keepalive: true,
      referrerPolicy: 'no-referrer'
    });
  } catch {
    return queueRetry(state, now);
  }

  if (response.status === 204) {
    await chrome.storage.local.set({ [LAST_SENT_KEY]: now });
    await chrome.storage.local.remove([PENDING_KEY, RETRY_KEY]);
    await scheduleFlush();
    return { sent: true };
  }
  if (response.status >= 400 && response.status < 500 && response.status !== 429) {
    await clearPending();
    await scheduleFlush();
    return { sent: false, reason: 'schema' };
  }
  return queueRetry(state, now);
}

async function queueRetry(state, now) {
  const attempt = (state.retry?.attempt || 0) + 1;
  if (attempt > RETRY_DELAYS_MS.length) {
    await clearPending();
    await scheduleFlush();
    return { sent: false, reason: 'dropped' };
  }
  const nextAt = now + RETRY_DELAYS_MS[attempt - 1];
  await chrome.storage.local.set({ [RETRY_KEY]: { attempt, nextAt } });
  await scheduleFlush(Math.ceil((nextAt - now) / 60000));
  return { sent: false, reason: 'retry', attempt };
}

export function installMetrics() {
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === METRICS_ALARM) {
      flushMetrics().catch(() => {});
    }
  });
  chrome.runtime.onInstalled.addListener(() => {
    ensureMetricsAlarm().catch(() => {});
  });
  chrome.runtime.onStartup.addListener(() => {
    ensureMetricsAlarm().catch(() => {});
  });
}
