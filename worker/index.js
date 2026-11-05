import schema from '../tests/fixtures/metrics-schema.json' with { type: 'json' };
import { dataPoints, tooManyPoints, validBatch } from './metrics-batch.js';

const PATH = '/v1/batch';
const EXTENSION_ORIGINS = [
  'chrome-extension://ongoinfbkmfffpmnkinhnoepdclbkenc',
  'chrome-extension://hcielebbeilidlkedpobbclikllnmggn'
];
/** Firefox gives every install its own id, so only the form can be checked. */
const FIREFOX_ORIGIN = /^moz-extension:\/\/[0-9a-f-]{36}$/;

const allowedOrigin = origin =>
  origin !== null && (EXTENSION_ORIGINS.includes(origin) || FIREFOX_ORIGIN.test(origin));

function reply(status, origin, extra = {}) {
  const headers = { 'Cache-Control': 'no-store', ...extra };
  if (allowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  return new Response(null, { status, headers });
}

/** The body as text, or null once it passes the limit in bytes, without reading the rest. */
async function readBody(request, limit) {
  if (Number(request.headers.get('Content-Length')) > limit) {
    return null;
  }
  const chunks = [];
  let total = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (let read = await reader.read(); !read.done; read = await reader.read()) {
      total += read.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(read.value);
    }
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function acceptBatch(request, env, origin) {
  const { success } = env.RATE_LIMITER
    ? await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })
    : { success: true };
  if (!success) {
    return reply(429, origin);
  }
  const type = request.headers.get('Content-Type') ?? '';
  if (type.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return reply(400, origin);
  }
  const text = await readBody(request, schema.limits.maxBodyBytes);
  if (text === null) {
    return reply(413, origin);
  }
  const batch = parse(text);
  if (tooManyPoints(batch, schema)) {
    return reply(413, origin);
  }
  if (!validBatch(batch, schema)) {
    return reply(400, origin);
  }
  for (const point of dataPoints(batch)) {
    env.METRICS.writeDataPoint(point);
  }
  return reply(204, origin);
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== PATH) {
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    const origin = request.headers.get('Origin');
    if (!allowedOrigin(origin)) {
      return reply(400, origin);
    }
    if (request.method === 'OPTIONS') {
      return reply(204, origin, {
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      });
    }
    return request.method === 'POST' ? acceptBatch(request, env, origin) : reply(400, origin);
  }
};
