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

export const SUPPORT_EMAIL = 'rfsbraz@gmail.com';

export function validateListingAccuracy({ config, locales }) {
  const errors = [];
  if (config.supportEmail !== SUPPORT_EMAIL) {
    errors.push(`supportEmail must be ${SUPPORT_EMAIL}`);
  }
  for (const [id, locale] of Object.entries(locales)) {
    const description = locale.description?.join('\n') || '';
    if (/AFILIADOS OPCIONAIS/i.test(description)) {
      errors.push(`${id}: affiliate must be a footnote, not a dedicated section`);
    }
    if (
      !/Afiliados Wook ativos por predefinição/i.test(description) ||
      !/Podes desativar/i.test(description) ||
      !/comiss[aã]o/i.test(description)
    ) {
      errors.push(`${id}: missing Wook affiliate default-on optional disclosure`);
    }
    const productMarker = description.indexOf('A TUA ESTANTE');
    const affiliateMarker = description.search(/Afiliados Wook ativos por predefinição/i);
    if (productMarker >= 0 && affiliateMarker >= 0 && affiliateMarker < productMarker) {
      errors.push(`${id}: affiliate disclosure appears before the product pitch`);
    }
    const privacyIdx = description.indexOf('CONTROLO E PRIVACIDADE');
    if (privacyIdx >= 0) {
      const after = description.slice(privacyIdx).split(/\n\n/)[1] || '';
      if (/Afiliados Wook|comiss[aã]o/i.test(after)) {
        errors.push(`${id}: Controlo e privacidade repeats affiliate marketing copy`);
      }
    }
    if (/Sem conta ou telemetria/i.test(description)) {
      errors.push(`${id}: absolute permanent zero-telemetry claim`);
    }
    if (
      !/Nesta versão[^.\n]{0,120}não envia[^.\n]{0,80}(estatísticas|telemetria)/i.test(description)
    ) {
      errors.push(`${id}: missing current-state telemetry wording`);
    }
    if (
      /envia estatísticas de utilização\./i.test(description) &&
      !/não envia estatísticas de utilização/i.test(description)
    ) {
      errors.push(`${id}: claims metrics already exist`);
    }
    if (
      /26 (lojas|adaptadores)[^.\n]{0,60}verificad/i.test(description) ||
      /todas as 26/i.test(description)
    ) {
      errors.push(`${id}: unsupported all-stores-verified claim`);
    }
    if (/proton\.me/i.test(description)) {
      errors.push(`${id}: support contact still uses proton.me`);
    }
    if (!description.includes(SUPPORT_EMAIL)) {
      errors.push(`${id}: support contact missing ${SUPPORT_EMAIL}`);
    }
  }
  return errors;
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
  errors.push(...validateListingAccuracy({ config, locales }));
  for (const field of ['privacyPolicyUrl', 'supportUrl', 'homepageUrl']) {
    if (config[field] && !/^https:\/\//.test(config[field])) {
      errors.push(`${field} must be public HTTPS`);
    }
  }
  return errors;
}
