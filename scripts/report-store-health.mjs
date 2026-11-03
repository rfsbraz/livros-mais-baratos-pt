import { STORES } from '../extension/stores.js';
export const marker = '<!-- store-health-monitor:v1 -->';

export function issueBody(report, runUrl) {
  const expected = STORES.map(s => s.id).sort();
  const actual = (report?.results || []).map(r => r.store).sort();
  const complete = report?.complete === true && JSON.stringify(expected) === JSON.stringify(actual);
  const failures = (report?.results || []).filter(r => r.status !== 'ok');
  const healthy = complete && failures.length === 0;
  const lines = [marker, 'Live checks use the shipped store adapters and book-page detector.', '',
    `[Workflow run and diagnostic artifact](${runUrl})`, '',
    `Coverage: ${report?.results?.length || 0}/${expected.length} automatic stores. Complete: ${complete ? 'yes' : 'no'}.`, '',
    'Each failed store is retried once. Prices and stock may change; fixed prices and in-stock availability are not required.',
    'Access blocks, missing samples and network failures do not by themselves prove a broken parser.', ''];
  if (!complete) lines.push('The checker did not produce a complete report. Inspect the workflow logs before diagnosing store patterns.', '');
  if (failures.length) {
    lines.push('| Store | Sample ISBN | Failure | Attempts |', '|---|---|---|---|');
    for (const result of failures) {
      const store = STORES.find(s => s.id === result.store);
      if (!store) continue;
      const known = new Set(['access-blocked', 'shop-server-error', 'network-error', 'page-missing', 'request-failed', 'pattern-unverified', 'invalid-offer', 'product-pattern', 'page-detection']);
      lines.push(`| ${store.name} | ${store.sample} | ${known.has(result.status) ? result.status : 'unknown'} | ${result.attempts?.length || 0} |`);
    }
  }
  lines.push('', 'Reproduce with `npm ci`, `npx playwright install chromium`, then `npm run test:live`.',
    'Review work/store-health.json. Update retired sample ISBNs in extension/stores.js or repair the adapter and add a deterministic regression fixture.',
    'Manual-only stores and reference entries have no automatic parser and are outside this check.');
  return { healthy, body: lines.join('\n') };
}

export async function syncIssue({ github, repo, report, runUrl }) {
  const { healthy, body } = issueBody(report, runUrl);
  const issues = await github.paginate(github.rest.issues.listForRepo, { ...repo, state: 'all', per_page: 100 });
  const existing = issues.find(i => !i.pull_request && i.user?.type === 'Bot' && i.body?.startsWith(marker) && i.state === 'open')
    || issues.find(i => !i.pull_request && i.user?.type === 'Bot' && i.body?.startsWith(marker));
  if (healthy) {
    if (existing?.state === 'open') await github.rest.issues.update({
      ...repo, issue_number: existing.number, state: 'closed', state_reason: 'completed',
      body: `${body}

All stores passed in this run. The monitor closed this issue automatically.`
    });
    return;
  }
  const params = { ...repo, title: 'Live store page checks are failing', body, state: 'open' };
  if (existing) await github.rest.issues.update({ ...params, issue_number: existing.number });
  else await github.rest.issues.create(params);
}
