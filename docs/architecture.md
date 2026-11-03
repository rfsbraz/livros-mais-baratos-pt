# Architecture

Manifest V3, plain ES modules, no runtime dependencies and no backend. The popup owns manual comparisons. Automatic-by-default alerts use a service worker, dynamically registered content scripts and a hidden offscreen document for DOM parsing. No periodic scraping or scheduled monitoring is installed.

## Automatic page alerts

The manifest declares exactly the 26 configured shop origins in `host_permissions`. Fresh installs use `autoEnabled !== false` with all shops selected, without writing preferences or opening the toolbar. Explicitly saved false values remain disabled across updates and restarts. The popup checks existing grants rather than requesting site access at runtime. The service worker registers `content.js` only on selected, granted hosts, including currently open tabs. Install/startup, permission changes and preference changes reconcile registration. Disabling or changing configuration closes the offscreen document to cancel requests and discard cache, and tells existing page scripts to remove stale notices.

The content script parses the current product DOM using the existing ISBN and price adapters. It rejects search pages, marketplace sources, identified digital formats and unverifiable current prices. It observes delayed page content and URL changes, invalidates stale asynchronous results and supports back/forward cache restoration. The worker validates the sender's extension ID, top-level frame, source URL, selected/granted source and current-offer fields before forwarding only book metadata. Full page HTML is not sent outside the tab.

The offscreen document uses the same comparison adapters. At most two distinct edition/selection jobs run with four shared store slots, a 90-second job deadline and 35-second store deadline. Concurrent identical requests share a job. Results are cached in memory for ten minutes with a 50-entry bound. Comparisons accept only a strictly cheaper, in-stock new EUR offer from another non-marketplace store. Alerts display the observation time and price difference, distinguishing estimated delivered totals from item-only comparisons with unknown shipping. Cached results are not historical observations. Page dismissal suppresses that ISBN for the current document.

Browser tests exercise the native content-script, worker and offscreen-message flow in an isolated Chromium extension. Only the network boundary is replaced in the temporary test copy because Playwright page routing does not intercept hidden offscreen targets. Public shop access remains covered separately by the live smoke script. See Chrome's [offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen) and [dynamic content-script registration](https://developer.chrome.com/docs/extensions/reference/api/scripting#method-registerContentScripts).

`stores.js` is the single catalogue for adapters, permissions, search routes, manual sources and aliases. `core.js` validates identifiers, normalizes amounts into integer minor units, checks links and bounds history. `parser.js` reads inert DOM documents and JSON-LD. `compare.js` tries ISBN and optional title search, visiting at most six unique product candidates with a 12-second request deadline. The popup limits concurrency to four stores and each store to 35 seconds. A generation token and cancellation prevent stale results replacing newer searches. Interrupted comparisons do not persist partial history. Storage writes are queued to avoid overwriting a later action with an earlier save.

## Matching rules

Only valid ISBNs are accepted; ISBN-10 is normalized to ISBN-13, including Unicode hyphens. Title search only discovers candidates; a product must still match the requested ISBN. Separate Book/Product fallback requires explicit page ISBN and exactly one Product on a product route. Open Graph price fallback requires a verified product page. SKU is trusted as ISBN only for stores where that mapping was observed. Aggregate `lowPrice`, unapproved currencies and external seller URLs are rejected. Explicit GBP/USD are supported for selected international stores, without conversion. Condition and currency remain separate in history. Only new, non-marketplace EUR offers with confirmed `InStock` qualify for the lowest-price marker. Known inconsistent stock metadata is shown as unknown.

## Store adapters

Wook uses `/pesquisa?keyword={isbn}`, Bertrand uses `/pesquisa/{isbn}`, and both use `/livro/` product links. Almedina uses the catalog search route and product paths. Wook and Almedina may redirect an exact ISBN search to a product. The final response must remain on the store origin. Wook omits currency in JSON-LD, so its adapter requires a matching ISBN and reads the explicit euro price in `#product-price .price` instead of unrelated recommendations. Bookcover uses the public WooCommerce Store API `/wp-json/wc/store/v1/products?sku={isbn}` and validates the returned SKU, EUR currency and minor units. Its ordinary search does not match ISBNs.

The expanded catalogue and observed extraction rules are documented in [store coverage](store-coverage.md). Mundo Fantasma uses the public Svelte search data response only to find product SKUs; a bounded index reader creates product links, then independently verifies ISBN and price in product JSON-LD. Saída de Emergência uses its displayed sale price instead of stale structured pricing. Other publisher adapters associate a labelled ISBN with a single Product. Cart/wishlist action links are rejected before fetching. HTML/JSON bodies are limited to 4 MB; no downloaded scripts execute.

Routes and schemas may change. Blocks, unsupported schemas and invalid responses produce an unavailable/unverified row with a manual shop link. Browser tests use reconstructed fixtures from observed public fields, plus adversarial and UI scenarios. A real Manifest V3 smoke test checks native loading and storage. Live tests are separate from CI: 18 of 26 adapters returned verified sample offers on 2026-11-03. Run `node scripts/live-smoke.mjs` for all stores or append store IDs for a subset; it pre-grants only the configured hosts in a temporary test copy. No private source is sent to an external browser service.

## Store publication assets

Run `npm run build`, `node scripts/store-assets.mjs` and `node scripts/store-metadata.mjs` from the repository root. Versioned output is written under the sibling `outputs/` directory. Captures use the real UI with labelled demonstration data. The upload ZIP is copied from the tested build, and public privacy/support URLs remain pending hosting.

## Future work

Validate adapters against live pages and store terms before broad release. Add recorded, sanitized fixtures with date/provenance when permission permits. Shipping totals, target checks and local charts are described in targets-shipping-history.md. Automatic campaign detection, loyalty-credit breakdowns, wishlist import and any legal discount timing remain future work.

## Design

Ink `#172e59`, blue `#2458bb`, white `#ffffff`, mist `#eef3fc`, grey `#536278`, green `#16624a`. A small book-spine monogram anchors the header. Segoe UI carries controls and prices; Georgia gives book titles a literary feel. Prices align right, store names left, with one list rather than a grid of cards. Keyboard focus is visible; all dynamic merchant text is escaped through text nodes.
