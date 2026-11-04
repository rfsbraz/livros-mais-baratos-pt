import { format, resolveConfig } from 'prettier';
import { readFileSync, writeFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync('package.json'));
const manifest = JSON.parse(readFileSync('manifest.json'));
manifest.version = version;
writeFileSync(
  'manifest.json',
  await format(JSON.stringify(manifest), {
    ...(await resolveConfig('manifest.json')),
    parser: 'json'
  })
);
writeFileSync('version.txt', version + '\n');
const listing = JSON.parse(readFileSync('store-listing/listing.json'));
writeFileSync(
  'store-links.js',
  await format(
    'export const STORE_URLS = ' +
      JSON.stringify(
        Object.fromEntries(
          Object.entries(listing.stores).map(([browser, store]) => [browser, store.url])
        )
      ) +
      ';',
    { ...(await resolveConfig('store-links.js')), parser: 'babel' }
  )
);
