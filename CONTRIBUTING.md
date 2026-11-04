# Contributing

Thank you for helping improve book-price comparisons in Portugal. Documentation, accessibility fixes, bug reports and carefully tested shop adapters are welcome. Read the [code of conduct](CODE_OF_CONDUCT.md) and report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Development setup

Use Node.js 22.13 or newer in the 22.x release line, Git, and a supported browser. Fork the repository when contributing from outside the maintainer team, then clone your fork:

```sh
git clone https://github.com/YOUR-USERNAME/livros-mais-baratos-pt.git
cd livros-mais-baratos-pt
npm ci
npx playwright install chromium firefox msedge
npm run build:all
```

Linux may need browser system packages: `npx playwright install --with-deps chromium firefox msedge`. Installing Edge may request administrator access. You do not need store credentials, a publisher account, Docker or a backend to develop and test the extension. The installed browser binaries stay outside the production ZIPs.

Load `dist/chrome` through `chrome://extensions` or `dist/edge` through `edge://extensions` with Developer mode enabled. In Firefox, open `about:debugging#/runtime/this-firefox`, choose Load Temporary Add-on and select `dist/firefox/manifest.json`. Rebuild and reload after source edits.

## Checks

```sh
npm run lint
npm run format:check
npm run check
npm run test:coverage
npm run build:all
npm run test:e2e
npm run store-listing:check
npm run audit:dependencies
```

`npm run format` applies formatting. `npm run test:e2e:chromium`, `test:e2e:firefox` and `test:e2e:edge` select one browser while iterating. CI runs all three. Browser tests use synthetic merchant responses and temporary isolated profiles, not a personal browser session.

If Make is available, `make build` builds all browsers, `make run` prints loading instructions, `make unit` runs unit tests, `make integration` builds then runs the three-browser suite, and `make test` runs both test groups. Windows contributors can use the npm commands directly.

For an optional local history scan, install Gitleaks and run `gitleaks git . --log-opts="--all --full-history" --redact`. CI uses a checksum-pinned scanner. Never paste secret values into issues or logs.

## Code and shop adapters

Use two-space indentation and plain ES modules. Separate parsing from network access, use `textContent` for untrusted data, and validate ISBN, currency and destination origin. Distinguish unknown availability, used copies, marketplace offers and loyalty credit. Do not bypass captchas, login requirements or access restrictions.

For a new shop:

1. Inspect public search and product pages. Confirm identifiers represent the book edition, not an internal SKU.
2. Update `stores.js`, the explicit manifest hosts, coverage documentation, and a small synthetic or sanitized fixture. Do not commit complete scraped pages, book covers, session cookies, customer data or authenticated HTML.
3. Add positive and negative cases: exact edition, a different ISBN, missing price, unavailable stock and blocked access where applicable.
4. Run `node scripts/live-smoke.mjs STORE_ID` only when a live check is needed. Record the date, public URL, ISBN and outcome in the coverage report. Temporary profiles/results remain in ignored `work/`.

Routine tests must work offline from retailer sites. Keep live monitoring separate and preserve its request spacing and rate-limit handling.

## Pull requests

Create a branch, keep the change focused, run the relevant checks and explain the problem and resulting behaviour in summary bullets. Include validation results and update documentation when behaviour changes. No CLA is required; contributions are submitted under this repository's MIT license. Only contribute material you have permission to share.

Use a single scoped conventional commit title, for example `fix(parser): reject a different ISBN`. Do not add attribution footers. Follow the PR template and respond constructively to review. A maintainer reviews and merges changes; approval is not promised on a fixed schedule.

## Dependencies and assets

The extension has no npm runtime dependencies. Development tools are locked in `package-lock.json`; commit manifest and lockfile changes together. The temporary minimatch 11.0.1 override fixes GHSA-g3hv-75wg-m249 in the lint toolchain. Remove it only when the upstream dependency graph resolves a patched version and the audit and lint checks pass.

Original icons and promotional layouts are included under the repository license. Screenshots contain labelled demonstration prices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for dependency and retailer-content boundaries. Rebuild listing assets with `npm run store-listing:assets` and do not claim an English UI merely because English listing text is supplied.

## Maintainer releases

Release Please follows this project's existing Node versioning and synchronizes package/manifest versions. Store publication is opt-in per browser and requires this extension's own credentials. See [store automation](store-listing/AUTOMATION.md). Forks should keep publishing and live monitors disabled, use their own store identities for redistribution, and review the disclosed Wook affiliate identifier in `affiliate.js`.

The [OSS preparation report](docs/oss-readiness.md) records the history audit and GitHub settings still needed at public launch. `npm run repo:configure` previews the protection/security settings without changing anything; `-- --apply` is a separate authenticated maintainer operation after publication. It never changes visibility.
