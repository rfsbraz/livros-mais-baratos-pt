import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { loadListing, validateListing } from './listing.mjs';
import { releaseNotes } from './changelog.mjs';
import { zipFiles } from './zip.mjs';

const listing = loadListing();
const errors = validateListing(listing);
if (errors.length) {
  throw new Error(errors.join('\n'));
}
const { config, locales } = listing;
const version = JSON.parse(readFileSync('package.json')).version;
const notes = releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version);
const out = resolve('dist/store-listing');
mkdirSync(out, { recursive: true });
const documents = [];
for (const store of ['chrome', 'firefox', 'edge']) {
  const dir = `${out}/${store}`;
  mkdirSync(dir, { recursive: true });
  const size = store === 'edge' ? 300 : 128;
  cpSync(`store-listing/icons/icon-${size}.png`, `${dir}/icon-${size}.png`);
  cpSync('store-listing/screenshots', `${dir}/screenshots`, { recursive: true });
  if (store === 'chrome') {
    cpSync('store-listing/promo', `${dir}/promo`, { recursive: true });
  }
  cpSync('store-listing/metadata/privacy-and-permissions.md', `${dir}/privacy-and-permissions.md`);
  cpSync('store-listing/metadata/reviewer-notes.txt', `${dir}/reviewer-notes.txt`);
  writeFileSync(`${dir}/release-notes.txt`, notes + '\n');
  for (const [id, locale] of Object.entries(locales)) {
    const target = `${dir}/${id}`;
    mkdirSync(target, { recursive: true });
    const metadata = {
      name: config.name,
      locale: locale.storeLocales[store],
      summary: locale.summary,
      description: locale.description.join('\n'),
      supportEmail: config.supportEmail,
      privacyPolicyUrl: config.privacyPolicyUrl,
      supportUrl: config.supportUrl,
      homepageUrl: config.homepageUrl,
      interfaceLanguages: ['pt-PT'],
      screenshots: locale.screenshots.map(file => `../screenshots/${file}`),
      screenshotLanguage: 'pt-PT',
      searchTerms: locale.searchTerms
    };
    writeFileSync(`${target}/listing.json`, JSON.stringify(metadata, null, 2) + '\n');
    writeFileSync(`${target}/description.txt`, metadata.description + '\n');
    writeFileSync(`${target}/summary.txt`, metadata.summary + '\n');
    documents.push(
      `## ${store} / ${id}\n\nName: ${config.name}\n\nSummary: ${locale.summary}\n\n${metadata.description}\n`
    );
  }
}
writeFileSync(
  `${out}/README.md`,
  '# Store upload pack\n\nVersion ' +
    version +
    '\n\nEach store folder contains its icon, ordered screenshots, Portuguese and English listing text, reviewer disclosures and release notes. The interface and screenshots are Portuguese. Prices in screenshots are illustrative.\n\nChrome and Edge listing text/images are dashboard uploads; their official publishing APIs update packages. Firefox text, previews and release notes are synchronized by the repository workflows. First submissions and publisher verification still require each store dashboard.\n\nSet public HTTPS privacy/support URLs in store-listing/listing.json before submission. Null means not configured, not a usable link. Host website/ on your chosen public domain. The source repository is private.\n'
);
cpSync('store-listing/website', `${out}/website`, { recursive: true });
cpSync('store-listing/icons', `${out}/icons`, { recursive: true });
cpSync('store-listing/asset-manifest.json', `${out}/asset-manifest.json`);
cpSync('store-listing/AUTOMATION.md', `${out}/AUTOMATION.md`);
writeFileSync(
  'store-listing/CHROME_UPDATE.md',
  documents.slice(0, config.locales.length).join('\n')
);
writeFileSync('store-listing/EDGE_UPDATE.md', documents.slice(-config.locales.length).join('\n'));
const entries = [];
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const file = resolve(dir, item.name);
    if (item.isDirectory()) {
      walk(file);
    } else if (item.name !== 'checksums.json') {
      entries.push({ name: relative(out, file).replaceAll('\\', '/'), data: readFileSync(file) });
    }
  }
}
walk(out);
const hashes = Object.fromEntries(
  entries.map(e => [e.name, createHash('sha256').update(e.data).digest('hex')])
);
writeFileSync(`${out}/checksums.json`, JSON.stringify(hashes, null, 2) + '\n');
entries.push({ name: 'checksums.json', data: readFileSync(`${out}/checksums.json`) });
zipFiles(entries, `dist/livros-mais-baratos-pt-${version}-store-assets.zip`);
console.log(`Prepared ${entries.length} files for Chrome, Firefox and Edge.`);
