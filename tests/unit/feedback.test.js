import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { feedbackLinks } from '../../feedback.js';
import { STORE_URLS } from '../../store-links.js';
test('feedback routes to each browser store and a user-submitted GitHub issue without book data', () => {
  const listing = JSON.parse(readFileSync('store-listing/listing.json'));
  for (const [browser, ua] of [
    ['chrome', 'Chrome/140'],
    ['firefox', 'Firefox/140'],
    ['edge', 'Chrome/140 Edg/140']
  ]) {
    const links = feedbackLinks('0.1.6', ua);
    assert.equal(links.rate, listing.stores[browser].url);
    assert.equal(STORE_URLS[browser], links.rate);
    const issue = new URL(links.issue);
    assert.equal(issue.origin, 'https://github.com');
    assert.equal(issue.pathname, '/rfsbraz/livros-mais-baratos-pt/issues/new');
    assert.deepEqual([...issue.searchParams.keys()], ['template', 'environment']);
    assert.equal(issue.searchParams.get('environment'), `${browser} · Extensão 0.1.6`);
  }
});
