import { readFile } from 'node:fs/promises';
import { createHmac, randomUUID } from 'node:crypto';
const config = JSON.parse(await readFile('store-listing/listing.json', 'utf8'));
const payload = {
  summary: { 'pt-PT': config.summary },
  description: { 'pt-PT': await readFile('store-listing/metadata/description-pt-PT.txt', 'utf8') }
};
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  if (!process.env.AMO_JWT_ISSUER || !process.env.AMO_JWT_SECRET) {
    throw new Error('AMO credentials are required');
  }
  const now = Math.floor(Date.now() / 1000),
    encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const body =
    encode({ alg: 'HS256', typ: 'JWT' }) +
    '.' +
    encode({ iss: process.env.AMO_JWT_ISSUER, jti: randomUUID(), iat: now, exp: now + 60 });
  const token =
    body + '.' + createHmac('sha256', process.env.AMO_JWT_SECRET).update(body).digest('base64url');
  const r = await fetch(
    'https://addons.mozilla.org/api/v5/addons/addon/' +
      encodeURIComponent(config.stores.firefox.id) +
      '/',
    {
      method: 'PATCH',
      headers: { Authorization: 'JWT ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    }
  );
  if (!r.ok) {
    throw new Error('AMO listing update returned HTTP ' + r.status);
  }
  console.log('Firefox listing updated.');
}
