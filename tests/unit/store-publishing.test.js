import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  loadListing,
  validateListing,
  validateListingAccuracy,
  SUPPORT_EMAIL,
  amoPayload
} from '../../scripts/listing.mjs';
import { syncListing } from '../../scripts/amo-listing.mjs';
import {
  buildPlan,
  diffPreviews,
  applyPlan,
  pixelHash,
  withRetry,
  versionExists
} from '../../scripts/amo-release.mjs';
import { releaseNotes } from '../../scripts/changelog.mjs';
import { buildNotes } from '../../scripts/edge-cert-notes.mjs';

const PUBLIC_SITE = 'https://livros-mais-baratos-pt.rfsbraz.workers.dev';

test('listing uses the Portuguese locale, real images and the production summary', () => {
  const listing = loadListing();
  assert.deepEqual(validateListing(listing), []);
  assert.deepEqual(Object.keys(amoPayload(listing).summary), ['pt-PT']);
  const bad = structuredClone(listing);
  bad.locales['pt-PT'].screenshots = ['../../private.png'];
  bad.locales['pt-PT'].summary = 'x'.repeat(133);
  assert.equal(validateListing(bad).length, 3);
});

test('listing points public pages at the hosted Worker site', () => {
  const listing = loadListing();
  assert.equal(listing.config.homepageUrl, `${PUBLIC_SITE}/`);
  assert.equal(listing.config.privacyPolicyUrl, `${PUBLIC_SITE}/privacy.html`);
  assert.equal(listing.config.supportUrl, `${PUBLIC_SITE}/support.html`);
  assert.deepEqual(validateListing(listing), []);
  const metadata = JSON.parse(readFileSync('store-listing/metadata/listing.json', 'utf8'));
  assert.equal(metadata.homepageUrl, listing.config.homepageUrl);
  assert.equal(metadata.privacyPolicyUrl, listing.config.privacyPolicyUrl);
  assert.equal(metadata.supportUrl, listing.config.supportUrl);
});

test('previewing listing is offline and applying requires credentials', async () => {
  const listing = loadListing();
  const fetcher = () => {
    throw new Error('Unexpected network request');
  };
  assert.deepEqual(await syncListing({ listing, fetcher }), amoPayload(listing));
  await assert.rejects(syncListing({ listing, fetcher, apply: true, env: {} }), /credentials/);
  const calls = [];
  await syncListing({
    listing,
    apply: true,
    env: { AMO_JWT_ISSUER: 'test', AMO_JWT_SECRET: 'test' },
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return { ok: true };
    }
  });
  assert.equal(calls.length, 1);
  assert(calls[0].url.includes('livros-mais-baratos-pt'));
  assert.deepEqual(JSON.parse(calls[0].options.body), amoPayload(listing));
});

test('release notes select the exact tag, not unreleased or another version', () => {
  const log = '# Changelog\n## Unreleased\n- future\n## 1.2.3\n- shipped\n## 1.2.2\n- old';
  assert.equal(releaseNotes(log, '1.2.3'), '- shipped');
  assert.throws(() => releaseNotes(log, '1.2.4'), /no entries/);
  assert.equal(
    buildNotes({ changelog: log, version: '1.2.3', template: 'Review steps' }),
    'Review steps\n\nAlterações na versão 1.2.3:\n- shipped'
  );
});

test('release screenshots are ordered and reruns keep identical pixels', () => {
  const plan = buildPlan({
    changelog: readFileSync('CHANGELOG.md', 'utf8'),
    version: '0.1.5',
    assetsDir: 'store-listing/screenshots'
  });
  assert.deepEqual(Object.keys(plan.notesPayload.release_notes), ['pt-PT']);
  assert.equal(plan.previews.length, 5);
  assert.deepEqual(
    plan.previews.map(p => p.position),
    [0, 1, 2, 3, 4]
  );
  const desired = plan.previews.map(p => ({ ...p, hash: pixelHash(readFileSync(p.path)) }));
  assert.deepEqual(
    diffPreviews(
      desired,
      desired.map((p, i) => ({ ...p, id: i }))
    ),
    { upload: [], remove: [], move: [] }
  );
  assert.deepEqual(
    diffPreviews([{ hash: 'same', position: 0 }], [{ id: 9, hash: 'same', position: 3 }]).move,
    [{ id: 9, position: 0 }]
  );
});

test('failed screenshot upload preserves the existing live previews', async () => {
  const plan = buildPlan({
    changelog: readFileSync('CHANGELOG.md', 'utf8'),
    version: '0.1.5',
    assetsDir: 'store-listing/screenshots'
  });
  const methods = [];
  const request = async method => {
    methods.push(method);
    if (method === 'GET') {
      return { previews: [{ id: 1, position: 0, image_url: 'fixture' }] };
    }
    if (method === 'POST') {
      throw new Error('Upload failed');
    }
    return {};
  };
  await assert.rejects(
    applyPlan(plan, { request, fetchImage: async () => Buffer.from('unreadable'), log: () => {} }),
    /Upload failed/
  );
  assert(!methods.includes('DELETE'));
});

test('rate limiting retries with Retry-After and authentication errors stop immediately', async () => {
  let calls = 0;
  const waits = [];
  const request = withRetry(
    async () => {
      if (++calls === 1) {
        throw Object.assign(new Error(), { status: 429, retryAfter: '2' });
      }
      return true;
    },
    { sleep: async ms => waits.push(ms), log: () => {} }
  );
  assert.equal(await request('GET', 'fixture'), true);
  assert.deepEqual(waits, [2000]);
  await assert.rejects(
    withRetry(async () => {
      throw Object.assign(new Error('denied'), { status: 401 });
    })(),
    /denied/
  );
  assert.equal(
    await versionExists(async () => {
      throw Object.assign(new Error(), { status: 404 });
    }, '1.2.3'),
    false
  );
  await assert.rejects(
    versionExists(async () => {
      throw Object.assign(new Error('denied'), { status: 401 });
    }, '1.2.3'),
    /denied/
  );
});

test('listing accuracy covers support email, affiliates, telemetry and store claims', () => {
  const listing = loadListing();
  assert.deepEqual(validateListingAccuracy(listing), []);
  assert.equal(listing.config.supportEmail, SUPPORT_EMAIL);
  const bad = structuredClone(listing);
  bad.config.supportEmail = 'rfsbraz@proton.me';
  bad.locales['pt-PT'].description = bad.locales['pt-PT'].description.map(line =>
    line
      .replaceAll(SUPPORT_EMAIL, 'rfsbraz@proton.me')
      .replace(/Sem conta\..*estatísticas anónimas[^.]*/, 'Sem conta ou telemetria')
  );
  const errors = validateListingAccuracy(bad);
  assert(errors.some(e => e.includes('supportEmail')));
  assert(errors.some(e => e.includes('absolute permanent zero-telemetry')));
  assert(errors.some(e => e.includes('proton.me')));
});

test('listing keeps affiliate as a late footnote, not an early section', () => {
  const listing = loadListing();
  const description = listing.locales['pt-PT'].description.join('\n');
  assert.equal(/AFILIADOS OPCIONAIS/i.test(description), false);
  const errors = validateListingAccuracy(listing);
  assert.deepEqual(errors, []);
  const productMarker = description.indexOf('A TUA ESTANTE');
  const affiliateMarker = description.search(
    /Afiliados Wook( e Bertrand)? ativos por predefinição/i
  );
  assert.ok(productMarker >= 0);
  assert.ok(affiliateMarker > productMarker);
  const early = description.slice(0, productMarker);
  assert.equal(/afiliad/i.test(early), false);
  const bad = structuredClone(listing);
  bad.locales['pt-PT'].description = [
    'O mesmo livro. Um preço melhor.',
    '',
    'AFILIADOS OPCIONAIS',
    'Afiliados Wook e Bertrand ativos por predefinição. Podemos receber uma comissão. Podes desativar na extensão.',
    '',
    'A TUA ESTANTE',
    'Guarda um livro.',
    '',
    'CONTROLO E PRIVACIDADE',
    'Sem conta. Podes partilhar estatísticas anónimas de desempenho (desativáveis em Definições).',
    '',
    `Interface em português de Portugal. Suporte: ${SUPPORT_EMAIL}.`
  ];
  const badErrors = validateListingAccuracy(bad);
  assert(badErrors.some(e => e.includes('footnote')));
  assert(badErrors.some(e => e.includes('before the product pitch')));
});
