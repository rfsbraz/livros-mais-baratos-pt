# Architecture

Manifest V3, plain ES modules, no runtime dependencies and no backend. The popup owns the lifetime of a comparison; closing it cancels the browser context. No periodic scraping or background worker is installed.

`stores.js` is the single catalogue for adapters, permissions, search routes, manual sources and aliases. `core.js` validates identifiers, normalizes amounts into integer minor units, checks links and bounds history. `parser.js` reads inert DOM documents and JSON-LD. `compare.js` tries ISBN and optional title search, visiting at most six unique product candidates with a 12-second request deadline. The popup limits concurrency to four stores and each store to 35 seconds. A generation token and cancellation prevent stale results replacing newer searches. Interrupted comparisons do not persist partial history. Storage writes are queued to avoid overwriting a later action with an earlier save.

## Matching rules

Only valid ISBNs are accepted; ISBN-10 is normalized to ISBN-13, including Unicode hyphens. Title search only discovers candidates; a product must still match the requested ISBN. Separate Book/Product fallback requires explicit page ISBN and exactly one Product on a product route. Open Graph price fallback requires a verified product page. SKU is trusted as ISBN only for stores where that mapping was observed. Aggregate `lowPrice`, unapproved currencies and external seller URLs are rejected. Explicit GBP/USD are supported for selected international stores, without conversion. Condition and currency remain separate in history. Only new, non-marketplace EUR offers with confirmed `InStock` qualify for the lowest-price marker. Known inconsistent stock metadata is shown as unknown.

## Store adapters

Wook uses `/pesquisa?keyword={isbn}`, Bertrand uses `/pesquisa/{isbn}`, and both use `/livro/` product links. Almedina uses the catalog search route and product paths. Wook and Almedina may redirect an exact ISBN search to a product. The final response must remain on the store origin. Wook omits currency in JSON-LD, so its adapter requires a matching ISBN and reads the explicit euro price in `#product-price .price` instead of unrelated recommendations. Bookcover uses the public WooCommerce Store API `/wp-json/wc/store/v1/products?sku={isbn}` and validates the returned SKU, EUR currency and minor units. Its ordinary search does not match ISBNs.

The expanded catalogue and observed extraction rules are documented in [store coverage](store-coverage.md). Mundo Fantasma uses the public Svelte search data response only to find product SKUs; a bounded index reader creates product links, then independently verifies ISBN and price in product JSON-LD. Saída de Emergência uses its displayed sale price instead of stale structured pricing. Other publisher adapters associate a labelled ISBN with a single Product. Cart/wishlist action links are rejected before fetching. HTML/JSON bodies are limited to 4 MB; no downloaded scripts execute.

Routes and schemas may change. Blocks, unsupported schemas and invalid responses produce an unavailable/unverified row with a manual shop link. Browser tests use reconstructed fixtures from observed public fields, plus adversarial and UI scenarios. A real Manifest V3 smoke test checks native loading and storage. Live tests are separate from CI: 18 of 26 adapters returned verified sample offers on 2026-11-03. Run `node scripts/live-smoke.mjs` for all stores or append store IDs for a subset; it pre-grants only the configured hosts in a temporary test copy. No private source is sent to an external browser service.

## Future work

Validate adapters against live pages and store terms before broad release. Add recorded, sanitized fixtures with date/provenance when permission permits. Add shipping-aware totals and loyalty-credit breakdowns before advertising total-price comparison. Background price alerts, campaign tracking, wishlist import and any legal discount timing require a separate design and validation step.

## Design

Ink `#172e59`, blue `#2458bb`, white `#ffffff`, mist `#eef3fc`, grey `#536278`, green `#16624a`. A small book-spine monogram anchors the header. Segoe UI carries controls and prices; Georgia gives book titles a literary feel. Prices align right, store names left, with one list rather than a grid of cards. Keyboard focus is visible; all dynamic merchant text is escaped through text nodes.
