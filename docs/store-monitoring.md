# Live store monitoring

The **Live store page checks** workflow wakes hourly at minute 17 UTC. Each of the 26 automatic stores has one stable slot per day, giving one or two stores per hour. A run checks only that slot, sequentially. There is no live batch on every push; deterministic PR/main CI still checks the saved parser fixtures.

Each store starts after a fresh random delay of 0-120 seconds. Network requests have another random delay of 1-3 seconds. These delays reduce bursts; they do not bypass access controls or guarantee that a shop will accept GitHub-hosted traffic.

The slot uses the GitHub run's creation timestamp, so queue/setup delays do not change the selected hour. GitHub schedules are best effort and can be delayed or skipped; a missed slot is not replayed as a batch. Manual Actions runs check their current slot. Re-running a workflow intentionally repeats its slot.

## What is checked

The shipped compareStore adapter searches using the configured sample ISBN and optional sampleTitle. A passing check requires a positive integer price in an allowed currency, a same-store product URL matching the adapter pattern, and the expected ISBN and a parseable price on that product page. Price changes and out-of-stock items are allowed. Manual-only shops and reference entries have no automatic parser and are excluded.

Comparisons have a 60-second limit; product verification has a 15-second limit. An hourly command is bounded to 13 minutes in Actions, with a 15-minute job limit. The network checker runs with read-only repository, Actions and issue access. Only the separate reporting job receives issues:write. No extra secret is required.

## Access errors and backoff

- rate-limited: HTTP 429. No immediate retry.
- authentication-required: HTTP 401. No immediate retry.
- access-forbidden: HTTP 403. No immediate retry.
- method-not-allowed: HTTP 405. No immediate retry.
- shop-server-error: HTTP 5xx.
- network-error: failed or timed-out request.
- page-missing: HTTP 404 or 410.
- pattern-unverified: the adapter could not verify an offer.
- invalid-offer: missing/invalid price or unexpected currency.
- product-pattern: result URL does not match the store product route.
- page-detection: product page does not identify the expected ISBN.
- request-failed: failure without more specific evidence.

HTTP 403 alone does not establish rate limiting. HTTP 202 can be a successful HTTP response without enough content to verify an offer, which is reported as pattern-unverified.

After 401/403/405/429, no further request to that origin is made during the run, including adapter fallback candidates. Retry-After, when present, also stops further requests and is recorded as a cooldown. Both delay-seconds and HTTP-date formats are supported. A 429 without Retry-After gets a 24-hour cooldown. Cooldowns persist in the bot-owned issue and are read before subsequent CI checks. A skipped cooldown is not treated as recovery.

Other failures get at most one retry after a random 20-40 seconds, provided the shop did not request a cooldown. There are no CAPTCHA workarounds or affiliate requests.

## Failure tracking across hourly batches

One bot-owned issue tracks outstanding failures. Each run updates only stores actually checked. Passing one hourly batch cannot close failures from other slots. The issue closes when all previously failing stores have passed; a later failure reopens it. Missing or incomplete reports open/update a checker failure and cannot clear existing store failures.

A compact encoded JSON comment in the issue stores failure state and cooldowns. This is plain encoded data, not encrypted or executable content. The reporter migrates failure rows from the original whole-catalogue issue, so existing failures remain until checked again. No new issue or comment is created on every hourly run.

The store-health JSON artifact is retained for 14 days. It contains sample ISBNs, URLs, HTTP status codes, error types, cooldown timestamps and retry results. It excludes page HTML, cookies and other response headers.

## Local reproduction

Run npm ci and npx playwright install chromium once.

- npm run test:live: current hourly slot, with jitter.
- npm run test:live -- wook: one named store.
- npm run test:live -- wook bookcover: selected stores, sequentially.
- npm run test:live -- --all: explicit local full check, never used by scheduled CI.

Local runs do not load GitHub's persisted cooldown state automatically. Avoid manual repeats while a shop has requested a cooldown. Inspect work/store-health.json before diagnosing a parser failure. For parser changes, add a minimal sanitized fixture and run npm run test:coverage and npm run test:integration.

HTTP semantics: [429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429), [Retry-After](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After).
