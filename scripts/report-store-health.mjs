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
    'As verificações utilizam os adaptadores das lojas e o detetor de páginas de livros distribuídos com a extensão.',
    '',
    '[Última execução e ficheiro de diagnóstico](' + runUrl + ')',
    '',
    'Nesta execução: ' +
      (report?.results?.length || 0) +
      '/' +
      expected.length +
      ' lojas previstas. Relatório completo: ' +
      (complete ? 'sim' : 'não') +
      '.',
    'As verificações distribuem-se por 24 intervalos horários, com uma ou duas lojas por intervalo e atrasos aleatórios.',
    'As falhas mantêm-se até a respetiva loja passar numa nova verificação. O sucesso de um grupo não elimina as falhas de outras lojas.',
    'HTTP 429 indica um limite de pedidos. Os códigos HTTP 401, 403 e 405 são apresentados separadamente e não comprovam esse limite.',
    ''
  ];
  if (!complete) {
    lines.push(
      'A verificação não produziu um relatório completo para as lojas previstas. Consulta os registos da execução.',
      ''
    );
  }
  const rows = Object.values(failures).sort((a, b) => a.store.localeCompare(b.store));
  if (rows.length) {
    lines.push(
      '| Loja | ISBN de exemplo | Falha | Última verificação (UTC) |',
      '|---|---|---|---|'
    );
    for (const r of rows) {
      const s = STORES.find(s => s.id === r.store);
      const checked = Number.isFinite(Date.parse(r.checkedAt))
        ? new Date(r.checkedAt).toISOString()
        : 'Verificação anterior';
      lines.push('| ' + s.name + ' | ' + s.sample + ' | ' + r.status + ' | ' + checked + ' |');
    }
  }
  lines.push(
    '',
    'Usa npm run test:live -- STORE_ID para verificar uma loja; --all executa explicitamente uma verificação local completa.',
    'Consulta docs/store-monitoring.md. As falhas de acesso e os exemplos indisponíveis não comprovam, por si só, uma falha de extração.',
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
          '\n\nTodas as lojas anteriormente em falha passaram na verificação. Esta issue foi fechada automaticamente.'
      });
    }
    return;
  }
  const params = {
    ...repo,
    title: 'Falhas na verificação das páginas das lojas',
    body,
    state: 'open'
  };
  if (existing) {
    await github.rest.issues.update({ ...params, issue_number: existing.number });
  } else {
    await github.rest.issues.create(params);
  }
}
