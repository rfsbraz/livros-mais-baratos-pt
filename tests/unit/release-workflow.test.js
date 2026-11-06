import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflow = readFileSync('.github/workflows/release.yml', 'utf8').replace(/\r\n/g, '\n');
const chromeJob = workflow.slice(
  workflow.indexOf('  publish-to-chrome:'),
  workflow.indexOf('  publish-to-firefox:')
);
const stepName = 'Verificar o ID de publicador Chrome';

function guardScript() {
  const step = chromeJob.slice(chromeJob.indexOf(stepName));
  const lines = step.slice(step.indexOf('run: |\n') + 'run: |\n'.length).split('\n');
  const end = lines.findIndex(line => !line.startsWith('          '));
  return lines
    .slice(0, end)
    .map(line => line.slice(10))
    .join('\n');
}

function runGuard(publisherId) {
  return spawnSync('bash', ['-c', guardScript()], {
    encoding: 'utf8',
    env: { ...process.env, CHROME_PUBLISHER_ID: publisherId }
  });
}

test('the publisher ID check runs before the Chrome upload', () => {
  const guard = chromeJob.indexOf(stepName);
  assert.notEqual(guard, -1);
  assert(guard < chromeJob.indexOf('mnao305/chrome-extension-upload@'));
  assert.match(chromeJob, /CHROME_PUBLISHER_ID: \$\{\{ vars\.CHROME_PUBLISHER_ID \}\}/);
});

test('an empty publisher ID fails and says where to find it', () => {
  const result = runGuard('');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^::error /);
  assert.match(result.stdout, /CHROME_PUBLISHER_ID/);
  assert.match(result.stdout, /Chrome Web Store Developer Dashboard/);
  assert.match(result.stdout, /Publisher > Settings/);
});

test('a set publisher ID passes silently', () => {
  const result = runGuard('publisher-for-test');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});
