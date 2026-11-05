import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readQueries } from '../../scripts/metrics-sql-check.mjs';

/** The functions in the Analytics Engine SQL reference that these queries may use. */
const DOCUMENTED = new Set([
  'NOW',
  'quantileExactWeighted',
  'sum',
  'sumIf',
  'toStartOfInterval',
  'toUInt32'
]);
const COLUMNS = /\b(?:blob[1-7]|double[1-3]|index1|timestamp|_sample_interval)\b/;

const SQL_WORDS = new Set(['AND', 'OR']);

const queries = readQueries(readFileSync('docs/metrics.md', 'utf8'));

test('the doc answers the seven questions', () => {
  assert.deepEqual(
    [...queries.keys()],
    ['q1', 'q2', 'q3a', 'q3b', 'q4a', 'q4b', 'q5a', 'q5b', 'q6a', 'q6b', 'q7']
  );
});

for (const [id, sql] of queries) {
  test(`${id} uses only documented functions and stored columns`, () => {
    const calls = [...sql.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)]
      .map(match => match[1])
      .filter(name => !SQL_WORDS.has(name));
    for (const name of calls) {
      assert(DOCUMENTED.has(name), `${name} is not in the Analytics Engine reference list`);
    }
    assert.match(sql, COLUMNS);
    assert(!/\bblob(?:[89]|1\d|20)\b|\bdouble(?:[4-9]|1\d|20)\b/.test(sql), 'unknown column');
    assert.match(sql, /FROM livros_metrics/);
    assert.match(sql, /FORMAT JSON\s*$/);
  });
}
