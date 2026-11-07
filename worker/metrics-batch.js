export { validBatch } from '../metrics-validation.js';

/** Numeric stand-in for the open-ended bucket, so percentiles above 35 s read as this value. */
export const OPEN_BUCKET_MS = 60000;

const isPlainObject = value => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Whether a batch has more points than one request may write. */
export const tooManyPoints = (batch, schema) =>
  isPlainObject(batch) &&
  Array.isArray(batch.points) &&
  batch.points.length > schema.limits.maxPoints;

function dataPoint(batch, point) {
  const bucket = point.bucket ?? '';
  const bucketMs = bucket === '' ? 0 : bucket === 'inf' ? OPEN_BUCKET_MS : Number(bucket);
  return {
    indexes: [point.metric],
    blobs: [
      point.metric,
      batch.browser,
      batch.version,
      point.surface ?? '',
      point.store ?? '',
      point.outcome ?? '',
      bucket
    ],
    doubles: [point.count, batch.sample_rate, bucketMs]
  };
}

/** What Analytics Engine stores for a batch: its points and one `batch` point to count the batches. */
export const dataPoints = batch => [
  ...batch.points.map(point => dataPoint(batch, point)),
  dataPoint(batch, { metric: 'batch', count: 1 })
];
