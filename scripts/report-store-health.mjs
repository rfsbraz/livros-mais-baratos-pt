import { STORES } from '../stores.js';
export const marker = '<!-- store-health-monitor:v1 -->';
const statePattern = /<!-- store-health-state:([A-Za-z0-9+/=]+) -->/;
const known = new Set([
  'access-blocked',
  'rate-limited',
  'authentication-required',
  'access-forbidden',
  'method-not-allowed',
  'shop-server-error',
  'network-error',
  'page-missing',
  'request-failed',
  'pattern-unverified',
  'invalid-offer',
  'product-pattern',
  'page-detection'
]);

export function readFailures(body = '') {
  try {
    const saved = JSON.parse(Buffer.from(body.match(statePattern)[1], 'base64').toString());
    if (!Array.isArray(saved)) {
      throw new Error('Invalid state');
    }
    return Object.fromEntries(
      saved
        .filter(r => STORES.some(s => s.id === r.store) && known.has(r.status))
        .map(r => [r.store, r])
    );
  } catch {
    // Migrate the original all-store issue without forgetting unchecked failures.
    const failures = {};
    for (const s of STORES) {
      const row = body
        .split('\n')
        .find(line => line.startsWith('| ' + s.name + ' | ' + s.sample + ' |'));
      const status = row?.split('|')[3]?.trim();
      if (known.has(status)) {
        failures[s.id] = { store: s.id, status, checkedAt: null };
      }
    }
    return failures;
  }
}

export function findMonitorIssue(issues) {
  const matches = issues.filter(
    i => !i.pull_request && i.user?.type === 'Bot' && i.body?.startsWith(marker)
  );
  return matches.find(i => i.state === 'open') || matches[0];
}

export function issueBody(report, runUrl, previousBody = '') {
  const expected = [...(report?.plannedStores || STORES.map(s => s.id))].sort();
  const actual = (report?.results || []).map(r => r.store).sort();
  const complete =
    report?.complete === true &&
    expected.length > 0 &&
    new Set(expected).size === expected.length &&
    expected.every(id => STORES.some(s => s.id === id)) &&
    JSON.stringify(expected) === JSON.stringify(actual);
  const failures = readFailures(previousBody);
  if (complete) {
    for (const result of report.results) {
      if (result.status === 'ok') {
        delete failures[result.store];
      } else if (known.has(result.status)) {
        failures[result.store] = {
          store: result.store,
          status: result.status,
          checkedAt: report.checkedAt || null,
          cooldownUntil: result.cooldownUntil || null,
          attempts: result.attempts?.length || 0
        };
      }
      // Cooldown skips retain the previous failure until an actual successful check.
    }
  }
  const healthy =
    complete && Object.keys(failures).length === 0 && report.results.every(r => r.status === 'ok');
  const lines = [
    marker,
    'Live checks use the shipped store adapters and book-page detector.',
    '',
    '[Latest workflow run and diagnostic artifact](' + runUrl + ')',
    '',
    'This run: ' +
      (report?.results?.length || 0) +
      '/' +
      expected.length +
      ' planned stores. Complete: ' +
      (complete ? 'yes' : 'no') +
      '.',
    'Checks are spread across 24 hourly slots, one or two stores per slot, with randomized delays.',
    'Unchecked failures remain here until that store passes. A successful hourly batch cannot clear another store.',
    'HTTP 429 means rate limited. HTTP 401, 403 and 405 are reported separately; they do not prove rate limiting.',
    ''
  ];
  if (!complete) {
    lines.push(
      'The checker did not produce a complete report for its planned stores. Inspect the workflow logs.',
      ''
    );
  }
  const rows = Object.values(failures).sort((a, b) => a.store.localeCompare(b.store));
  if (rows.length) {
    lines.push('| Store | Sample ISBN | Failure | Last checked (UTC) |', '|---|---|---|---|');
    for (const r of rows) {
      const s = STORES.find(s => s.id === r.store);
      const checked = Number.isFinite(Date.parse(r.checkedAt))
        ? new Date(r.checkedAt).toISOString()
        : 'Previous monitor';
      lines.push('| ' + s.name + ' | ' + s.sample + ' | ' + r.status + ' | ' + checked + ' |');
    }
  }
  lines.push(
    '',
    'Use npm run test:live -- STORE_ID to reproduce one store; --all is an explicit local full check.',
    'See docs/store-monitoring.md. Access failures and unavailable samples do not by themselves prove a broken parser.',
    '<!-- store-health-state:' + Buffer.from(JSON.stringify(rows)).toString('base64') + ' -->'
  );
  return { healthy, body: lines.join('\n') };
}

export async function syncIssue({ github, repo, report, runUrl }) {
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...repo,
    state: 'all',
    per_page: 100
  });
  const existing = findMonitorIssue(issues);
  const { healthy, body } = issueBody(report, runUrl, existing?.body);
  if (healthy) {
    if (existing?.state === 'open') {
      await github.rest.issues.update({
        ...repo,
        issue_number: existing.number,
        state: 'closed',
        state_reason: 'completed',
        body:
          body +
          '\n\nAll previously failing stores have now passed. The monitor closed this issue automatically.'
      });
    }
    return;
  }
  const params = { ...repo, title: 'Live store page checks are failing', body, state: 'open' };
  if (existing) {
    await github.rest.issues.update({ ...params, issue_number: existing.number });
  } else {
    await github.rest.issues.create(params);
  }
}
