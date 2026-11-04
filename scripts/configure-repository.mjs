import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Explicit maintainer operation. Never changes visibility, merges PRs or rewrites history.
const apply = process.argv.includes('--apply');
const repository = 'rfsbraz/livros-mais-baratos-pt';
const protection = JSON.parse(
  readFileSync(new URL('../.github/branch-protection.json', import.meta.url), 'utf8')
);
const operations = [
  { method: 'PUT', endpoint: `repos/${repository}/branches/main/protection`, body: protection },
  { method: 'PUT', endpoint: `repos/${repository}/vulnerability-alerts` },
  { method: 'PUT', endpoint: `repos/${repository}/private-vulnerability-reporting` }
];
if (!apply) {
  console.log(
    JSON.stringify(
      {
        repository,
        operations,
        note: 'Apenas pré-visualização. Aplica após a publicação e depois de estas verificações terem sido executadas no ramo main.'
      },
      null,
      2
    )
  );
} else {
  const repo = JSON.parse(execFileSync('gh', ['api', `repos/${repository}`], { encoding: 'utf8' }));
  if (repo.private) {
    throw new Error(
      'O repositório é privado. Esta configuração destina-se à publicação e não altera a visibilidade.'
    );
  }
  if (!repo.permissions?.admin) {
    throw new Error('É necessário acesso de administrador ao repositório.');
  }
  for (const operation of operations) {
    const args = ['api', '--method', operation.method, operation.endpoint, '--silent'];
    if (operation.body) {
      args.push('--input', '-');
    }
    execFileSync('gh', args, {
      input: operation.body ? JSON.stringify(operation.body) : undefined,
      stdio: ['pipe', 'inherit', 'inherit']
    });
    console.log(`Configurado: ${operation.endpoint}`);
  }
}
