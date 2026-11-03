# Live store monitoring

The **Live store page checks** workflow runs daily at 06:23 UTC, on relevant pushes to main, and manually from Actions. Schedules may be delayed by GitHub. It is separate from deterministic PR CI because external store availability is not a reliable merge gate.

All 26 automatic stores in extension/stores.js are included automatically. Each uses its sample ISBN and optional sampleTitle with the shipped compareStore adapter inside Chromium. A successful check requires a positive integer price in an allowed currency, a same-store product URL matching its pattern, and the book-page detector identifying the sample ISBN at that URL. Price changes and out-of-stock items are allowed. Manual-only stores and reference entries have no automatic parser and are excluded.

Three shops are checked concurrently. Failures get one retry after two seconds. Each comparison has a 35-second limit and its product-page check a 12-second limit. The command is bounded to 20 minutes in Actions, with a 25-minute job limit. No access challenges are bypassed and no affiliate links are used.

## Failure reporting

The job fails if any store fails or the check is incomplete. A separate job opens one bot-owned issue with the marker store-health-monitor:v1, updates it on subsequent failures, closes it only after all 26 pass, and reopens it on recurrence. It does not post duplicate comments. Missing or partial reports are reported as checker failures and cannot close an issue.

The issue links to the workflow and the store-health JSON artifact (retained for 14 days). The JSON contains sample ISBNs, URLs, request status codes and error types, plus retry results. It excludes page HTML, headers and cookies.

- access-blocked: HTTP 401, 403 or 429.
- shop-server-error: HTTP 5xx.
- network-error: failed or timed-out network request.
- page-missing: HTTP 404 or 410.
- pattern-unverified: search/product parsing could not verify an offer.
- invalid-offer: missing/invalid price or unexpected currency.
- product-pattern: result URL no longer matches the store's product route.
- page-detection: the product page no longer identifies the expected ISBN.
- request-failed: the adapter could not complete without more specific evidence.

These are diagnostic categories, not proof that the parser is broken. A product can disappear, a sample can become unavailable, or a store can block GitHub-hosted runners. Existing blocked adapters are included and may fail the first run. Inspect the artifact before updating sample ISBNs or changing selectors.

## Local reproduction

Run npm ci, npx playwright install chromium, then npm run test:live. Inspect work/store-health.json. For a parser change, preserve a minimal sanitized fixture under tests/fixtures and add a deterministic regression assertion. Run npm run test:coverage and npm run test:integration before merging.

The network job has read-only repository access. Only the separate reporting job receives issues:write, on main. PR code never runs with issue-write access in this workflow. Automatic issue management uses the built-in GITHUB_TOKEN; no new secret is needed.
