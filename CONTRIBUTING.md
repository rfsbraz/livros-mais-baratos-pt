# Contributing

Use Node.js 22+ and Git:

```sh
git clone https://github.com/rfsbraz/livros-mais-baratos-pt.git
cd livros-mais-baratos-pt
npm ci
npx playwright install chromium
make test
make build
make run
```

On Windows without Make, use `npm run test:coverage`, `npm run test:integration`, and `npm run build`. Load `dist/chrome/` as an unpacked Chrome extension to run locally. Reload it at `chrome://extensions` after changes.

`make unit` runs core tests with coverage. `make integration` runs browser tests using synthetic merchant responses, including blocked requests and persistence. `make test` runs both. No Docker service is needed for a browser-only extension. Live smoke checks are manual: open a real product page, verify ISBN and compare each displayed price against the matching edition in the store. Record date, store, ISBN and result; do not commit customer data or authenticated HTML.

Use two-space indentation, ES modules and named functions. Keep parsing separate from network access. Use `textContent` for merchant/user data. Validate ISBN, currency and destination origin before showing an offer. Treat unknown stock and loyalty credit explicitly. Do not work around captchas or access restrictions.

For a new shop, inspect its search and product pages first, then update `stores.js`, optional manifest hosts, the coverage report and a minimal sanitized fixture. Keep internal SKUs distinct from ISBNs. Use `node scripts/live-smoke.mjs STORE_ID` to test a selected adapter in a local Chromium extension; no logged-in browser or private pages are needed. The temporary profile and generated results stay in ignored `work/`. Record only public sample identifiers, URLs and outcomes in the research evidence.

Commit messages use a single scoped conventional title, for example `fix(parser): validate product ISBN before accepting price`. Keep PRs small, describe the changes in summary bullets, pass all checks, and update documentation when behavior changes. The PR template records change type, testing and the review checklist. Do not add attribution footers to commits or PRs.

## Release setup

The owner must configure `RELEASE_PLEASE_TOKEN` with repository permissions. Release Please uses simple versioning with conservative pre-1.0 bumps. Release automation synchronizes the manifest and package versions, builds the ZIP and attaches it to the release. No automatic Chrome Web Store publication occurs.

Main should require the `unit` and `browser` checks and enforce protection for administrators. GitHub rejected this configuration on 2026-11-03 because the current account needs Pro for private-repository protection. Visibility remains private. The patch auto-merge workflow skips merging unless it can verify both required checks in branch protection; minor/major updates always need review. Release automation remains idle until `RELEASE_PLEASE_TOKEN` is configured.

## Cross-browser development

See [reference alignment](docs/reference-alignment.md) for architecture, commands, browser installation and store configuration. Run `npm run build:all` before browser tests. Use `npm run format` to apply the shared style.
