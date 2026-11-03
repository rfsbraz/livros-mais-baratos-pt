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

On Windows without Make, use `npm run test:coverage`, `npm run test:integration`, and `npm run build`. Load `extension/` as an unpacked Chrome extension to run locally. Reload it at `chrome://extensions` after changes.

`make unit` runs core tests with coverage. `make integration` runs browser tests using synthetic merchant responses, including blocked requests and persistence. `make test` runs both. No Docker service is needed for a browser-only extension. Live smoke checks are manual: open a real product page, verify ISBN and compare each displayed price against the matching edition in the store. Record date, store, ISBN and result; do not commit customer data or authenticated HTML.

Use two-space indentation, ES modules and named functions. Keep parsing separate from network access. Use `textContent` for merchant/user data. Validate ISBN, currency and destination origin before showing an offer. Treat unknown stock and loyalty credit explicitly. Do not work around captchas or access restrictions.

Commit messages use a single scoped conventional title, for example `fix(parser): validate product ISBN before accepting price`. Keep PRs small, describe the changes in summary bullets, pass all checks, and update documentation when behavior changes. The PR template records change type, testing and the review checklist. Do not add attribution footers to commits or PRs.

## Release setup

The owner must configure `RELEASE_PLEASE_TOKEN` with repository permissions. Release Please uses simple versioning with conservative pre-1.0 bumps. Release automation synchronizes the manifest and package versions, builds the ZIP and attaches it to the release. No automatic Chrome Web Store publication occurs.

Main should require the `unit` and `browser` checks and enforce protection for administrators. Private-repository branch protection availability depends on the account plan. Patch dependency updates may auto-merge after required checks; minor/major updates need review.
