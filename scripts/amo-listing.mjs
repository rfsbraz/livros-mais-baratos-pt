import { resolve } from 'node:path';
import { loadListing, amoPayload, validateListing } from './listing.mjs';
import { makeJwt, withRetry } from './amo-release.mjs';
export async function syncListing({ listing, apply = false, fetcher = fetch, env = process.env }) {
  const payload = amoPayload(listing);
  if (!apply) {
    return payload;
  }
  if (!env.AMO_JWT_ISSUER || !env.AMO_JWT_SECRET) {
    throw new Error('AMO credentials are required');
  }
  const request = withRetry(async () => {
    const response = await fetcher(
      'https://addons.mozilla.org/api/v5/addons/addon/' +
        encodeURIComponent(listing.config.stores.firefox.id) +
        '/',
      {
        method: 'PATCH',
        headers: {
          Authorization: 'JWT ' + makeJwt(env.AMO_JWT_ISSUER, env.AMO_JWT_SECRET),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      }
    );
    if (!response.ok) {
      const error = new Error('AMO listing update returned HTTP ' + response.status);
      error.status = response.status;
      error.retryAfter = response.headers.get('retry-after');
      throw error;
    }
  });
  await request();
  return { updated: Object.keys(payload.summary) };
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const rootArg = process.argv.indexOf('--root');
  const root = rootArg < 0 ? '.' : process.argv[rootArg + 1];
  const listing = loadListing(root);
  const errors = validateListing(listing, root);
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
  console.log(
    JSON.stringify(await syncListing({ listing, apply: process.argv.includes('--apply') }), null, 2)
  );
}
