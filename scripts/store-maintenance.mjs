import { loadListing } from './listing.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { createHmac, randomUUID } from 'node:crypto';
const mode = process.argv[2];
if (!['credentials', 'drift'].includes(mode)) {
  throw new Error('Expected credentials or drift');
}
const { config, locales } = loadListing();
await mkdir('work/store-maintenance', { recursive: true });
const report = [];
const request = async (url, options = {}) => {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  if (!r.ok) {
    throw new Error('HTTP ' + r.status);
  }
  return r;
};
const plain = s =>
  String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
for (const store of ['chrome', 'edge', 'firefox']) {
  const cfg = config.stores[store];
  if (
    mode === 'drift' ? !cfg.url : process.env[store.toUpperCase() + '_PUBLISH_ENABLED'] !== 'true'
  ) {
    report.push({ store, status: 'skipped' });
    continue;
  }
  try {
    if (mode === 'credentials') {
      if (store === 'chrome') {
        const token = await (
          await request('https://oauth2.googleapis.com/token', {
            method: 'POST',
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: process.env.CHROME_CLIENT_ID || '',
              client_secret: process.env.CHROME_CLIENT_SECRET || '',
              refresh_token: process.env.CHROME_REFRESH_TOKEN || ''
            })
          })
        ).json();
        await request(
          `https://chromewebstore.googleapis.com/v2/publishers/${encodeURIComponent(process.env.CHROME_PUBLISHER_ID)}/items/${encodeURIComponent(process.env.CHROME_EXTENSION_ID)}:fetchStatus`,
          { headers: { Authorization: 'Bearer ' + token.access_token } }
        );
      } else if (store === 'edge') {
        const r = await fetch(
          `https://api.addons.microsoftedge.microsoft.com/v1/products/${encodeURIComponent(process.env.EDGE_PRODUCT_ID)}/submissions/operations/00000000-0000-0000-0000-000000000000`,
          {
            headers: {
              Authorization: 'ApiKey ' + process.env.EDGE_API_KEY,
              'X-ClientID': process.env.EDGE_CLIENT_ID
            },
            signal: AbortSignal.timeout(30000)
          }
        );
        if (![200, 404].includes(r.status)) {
          throw new Error('HTTP ' + r.status);
        }
        const expiry = Date.parse(process.env.EDGE_API_KEY_EXPIRES);
        if (!Number.isFinite(expiry) || expiry - Date.now() < 30 * 86400000) {
          throw new Error('É necessário rever a validade da chave da API');
        }
      } else {
        const now = Math.floor(Date.now() / 1000),
          encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
        const body =
          encode({ alg: 'HS256', typ: 'JWT' }) +
          '.' +
          encode({ iss: process.env.AMO_JWT_ISSUER, jti: randomUUID(), iat: now, exp: now + 60 });
        const jwt =
          body +
          '.' +
          createHmac('sha256', process.env.AMO_JWT_SECRET || '')
            .update(body)
            .digest('base64url');
        await request(
          `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(cfg.id)}/versions/`,
          { headers: { Authorization: 'JWT ' + jwt } }
        );
      }
      report.push({ store, status: 'clean' });
      continue;
    }
    const differences = [];
    for (const [id, locale] of Object.entries(locales)) {
      const language = locale.storeLocales[store];
      let live;
      if (store === 'chrome') {
        const html = await (await request(cfg.url + '?hl=' + encodeURIComponent(language))).text();
        const summary = html.match(/<meta name="description" content="([^"]*)"/);
        const overview = html.match(/<div jsname="ij8cu"[^>]*>([\s\S]*?)<\/div>/);
        const paragraphs = [...(overview?.[1] || '').matchAll(/<p>([\s\S]*?)<\/p>/g)];
        if (!summary || !paragraphs.length) {
          throw new Error('Página da loja não reconhecida');
        }
        live = { summary: summary[1], description: paragraphs.at(-1)[1] };
      } else if (store === 'edge') {
        const data = await (
          await request(
            `https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${encodeURIComponent(cfg.id)}?hl=${encodeURIComponent(language)}`
          )
        ).json();
        live = { summary: data.shortDescrição, description: data.description };
      } else {
        const data = await (
          await request(
            `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(cfg.id)}/`
          )
        ).json();
        live = { summary: data.summary?.[language], description: data.description?.[language] };
      }
      if (!live.summary || !live.description) {
        throw new Error('Texto da ficha em falta');
      }
      if (
        plain(live.summary) !== plain(locale.summary) ||
        plain(live.description) !== plain(locale.description.join('\n'))
      ) {
        differences.push(id);
      }
    }
    report.push({
      store,
      status: differences.length ? 'drift' : 'clean',
      detail: differences.length
        ? `A ficha difere em ${differences.join(', ')}. Consulta store-listing/CHROME_UPDATE.md ou EDGE_UPDATE.md, ou volta a sincronizar a ficha do Firefox.`
        : undefined
    });
  } catch (error) {
    report.push({
      store,
      status: 'error',
      detail: error.message.startsWith('HTTP ')
        ? error.message
        : 'A verificação falhou; revê a configuração da loja.'
    });
  }
}
await writeFile(
  'work/store-maintenance/report.json',
  JSON.stringify({ mode, results: report }, null, 2)
);
console.log(report.map(r => r.store + ': ' + r.status).join('\n'));
if (report.some(r => r.status === 'error')) {
  process.exitCode = 1;
}
