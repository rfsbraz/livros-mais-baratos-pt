import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runtimeFiles } from '../../scripts/build-multi.mjs';

test('the schema module used by the extension matches metrics-schema.json', async () => {
  const { default: schema } = await import('../../metrics-schema.js');
  assert.deepEqual(schema, JSON.parse(readFileSync('metrics-schema.json', 'utf8')));
});

// O service worker do Chrome falha ao reiniciar quando o grafo de módulos tem importações JSON.
test('packaged extension code has no JSON import attributes', () => {
  const offenders = runtimeFiles()
    .filter(file => file.endsWith('.js'))
    .filter(file => /\btype\s*:\s*['"]json['"]/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
});
