import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadListing(root = '.') {
  const read = file => JSON.parse(readFileSync(resolve(root, 'store-listing', file), 'utf8'));
  const config = read('listing.json');
  return {
    config,
    locales: Object.fromEntries(config.locales.map(id => [id, read(`locales/${id}.json`)]))
  };
}

export function amoPayload({ locales }) {
  const payload = { summary: {}, description: {} };
  for (const locale of Object.values(locales)) {
    const id = locale.storeLocales.firefox;
    payload.summary[id] = locale.summary;
    payload.description[id] = locale.description.join('\n');
  }
  return payload;
}

export function validateListing({ config, locales }, root = '.') {
  const errors = [];
  if (!config.locales.includes(config.defaultLocale)) {
    errors.push('Missing default locale');
  }
  for (const [id, locale] of Object.entries(locales)) {
    if (!locale.summary || [...locale.summary].length > 132) {
      errors.push(`${id}: invalid summary`);
    }
    const description = locale.description?.join('\n') || '';
    if (description.length < 250 || description.length > 10000) {
      errors.push(`${id}: invalid description`);
    }
    for (const store of ['chrome', 'edge', 'firefox']) {
      if (!locale.storeLocales?.[store]) {
        errors.push(`${id}: missing ${store} locale`);
      }
    }
    if (!locale.screenshots?.length || locale.screenshots.length > 5) {
      errors.push(`${id}: expected 1-5 screenshots`);
    }
    for (const file of locale.screenshots || []) {
      if (!/^\d+-[a-z0-9-]+-1280x800\.png$/.test(file)) {
        errors.push(`${id}: unsafe screenshot path`);
        continue;
      }
      try {
        const png = readFileSync(resolve(root, 'store-listing/screenshots', file));
        if (
          png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
          png.readUInt32BE(16) !== 1280 ||
          png.readUInt32BE(20) !== 800
        ) {
          errors.push(`${id}: invalid screenshot ${file}`);
        }
      } catch {
        errors.push(`${id}: missing screenshot ${file}`);
      }
    }
  }
  if (locales[config.defaultLocale]?.summary !== config.summary) {
    errors.push('Default summary differs from listing.json');
  }
  for (const field of ['privacyPolicyUrl', 'supportUrl', 'homepageUrl']) {
    if (config[field] && !/^https:\/\//.test(config[field])) {
      errors.push(`${field} must be public HTTPS`);
    }
  }
  return errors;
}
