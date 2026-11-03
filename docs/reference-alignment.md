# Extension architecture alignment

Reference: [Geocaching.com-Friends-Logs](https://github.com/rfsbraz/Geocaching.com-Friends-Logs), inspected at 9f46486230605c580abac1635d0c0297076cb271.

## Layout and commands

Runtime modules, manifest, popup and icons live at the repository root. `tests/unit` holds pure logic tests; `tests/e2e` holds browser tests with a Playwright report. Build tooling lives in `scripts`, and listing metadata and screenshots live in `store-listing`.

Run `npm ci`, `npm run lint`, `npm run format:check`, `npm run test:coverage`, `npm run build:all`, and `npm run test:e2e`. Install Edge for its native smoke test using `npx playwright install msedge`. Install test browsers with `npx playwright install chromium firefox`. Chrome and Edge packages use a service worker with an offscreen parser. Firefox uses a nonpersistent background page and a local parser iframe, retaining the same validated message boundary. Dynamic content registration preserves the saved automatic-alert and store selection settings. Runtime modules are shared. Firefox also bundles the content entry point into one script with esbuild, avoiding dynamic content-module loading. The browser package is built from an explicit runtime file list, excluding tooling and tests.

Load `dist/chrome` or `dist/edge` unpacked. Firefox development loading uses `about:debugging`, Load Temporary Add-on and `dist/firefox/manifest.json`. Release Firefox installation requires signing through AMO. Minimum Firefox is 140; host access and data-transmission consent remain browser-controlled. Chrome/Edge keep their existing declared permissions.

## Workflows

CI matches the reference's lint-and-test then e2e-tests pipeline, including formatting, all-browser packages, reports and screenshots. Compatibility gate jobs retain the previous `unit` and `browser` required-check names. Node 22 is retained because runtime-independent test code uses modern built-ins. Unit tests retain Node's built-in runner; migrating assertions to Jest adds no browser coverage.

Release uses separate release-please, target, build-release and publish-to-browser jobs. Release Please follows the reference's node release type and synchronizes the manifest. Dispatch supports rebuilding an existing tag and choosing the destination. Credentials have job-scoped access. Store publishing requires per-store enable variables and environments. No other extension's identifiers are reused.

PR titles follow conventional commits. Daily Dependabot patch auto-merge and weekly CI are retained. The hourly bookshop health workflow retains its 24-hour jitter plan and failure issue handling. Weekly credentials and listing drift jobs use separate check/report jobs and keepalive. Missing store URLs/disabled publishing are skipped; unreadable listings never close an existing drift issue.

## Publishing configuration

Before enabling publishing, create this extension's listings, set the public support/privacy URLs, update `store-listing/listing.json`, and configure `chrome-store`, `firefox-store`, `edge-store` environments with any desired reviewer rules.

- Release: `RELEASE_PLEASE_TOKEN` secret.
- Chrome: variables `CHROME_PUBLISH_ENABLED=true`, `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`; secrets `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`.
- Edge: variables `EDGE_PUBLISH_ENABLED=true`, `EDGE_API_KEY_EXPIRES` (YYYY-MM-DD); secrets `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`.
- Firefox: variable `FIREFOX_PUBLISH_ENABLED=true`; secrets `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`. GUID: `livros-mais-baratos-pt@rfsbraz.github.io`.

Keep publishing credentials as repository secrets if the scheduled credential check should use them, or give the check the same environment access. No listing IDs, credentials or publication are configured by this refactor. Store metadata synchronization is supplied as checked-in material and drift detection; Firefox listing edits use the preview-first Firefox listing workflow or the dashboard. Release submission uses the packaged version, so reruns after an already accepted submission must exclude that store using the dispatch selector.

Firefox native tests cover automatic comparisons, caching and scheduled targets through a test-only content bridge, because Playwright cannot drive privileged Firefox popup pages. Chromium covers full popup interactions; the Edge test uses Microsoft Edge. All fixtures and bridges are excluded from production packages.
