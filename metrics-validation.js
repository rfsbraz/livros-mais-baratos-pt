const BATCH_FIELDS = ['schema', 'browser', 'version', 'day', 'sample_rate', 'points'];
const DIMENSIONS = ['surface', 'store', 'outcome', 'bucket'];
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}(\.\d{1,6})?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isPlainObject = value => typeof value === 'object' && value !== null && !Array.isArray(value);
const onlyHas = (object, allowed) => Object.keys(object).every(key => allowed.includes(key));

export function validPoint(point, schema) {
  if (!isPlainObject(point)) {
    return false;
  }
  const dimensions = Object.hasOwn(schema.metrics, point.metric)
    ? schema.metrics[point.metric]
    : null;
  if (!dimensions || !onlyHas(point, ['metric', 'count', ...DIMENSIONS])) {
    return false;
  }
  if (!Number.isInteger(point.count) || point.count < 1 || point.count > schema.limits.maxCount) {
    return false;
  }
  return DIMENSIONS.every(name =>
    dimensions[name]
      ? schema.sets[dimensions[name]].includes(point[name])
      : !Object.hasOwn(point, name)
  );
}

/** Whether a batch is exactly what the schema allows: every value is from a closed list or a strict format. */
export function validBatch(batch, schema) {
  if (!isPlainObject(batch) || !onlyHas(batch, BATCH_FIELDS)) {
    return false;
  }
  const { browser, version, day, sample_rate: rate, points } = batch;
  const { maxPoints, maxStringLength } = schema.limits;
  return (
    batch.schema === schema.schema &&
    schema.browsers.includes(browser) &&
    typeof version === 'string' &&
    version.length <= maxStringLength &&
    VERSION.test(version) &&
    typeof day === 'string' &&
    DAY.test(day) &&
    typeof rate === 'number' &&
    rate > 0 &&
    rate <= 1 &&
    Array.isArray(points) &&
    points.length > 0 &&
    points.length <= maxPoints &&
    points.every(point => validPoint(point, schema))
  );
}
