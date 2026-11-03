# Architecture

Manifest V3, plain ES modules, no runtime dependencies and no backend. The popup owns the lifetime of a comparison; closing it cancels the browser context. No periodic scraping or background worker is installed.

`core.js` validates identifiers, normalizes EUR values into integer cents, checks links and bounds history. `parser.js` reads inert DOM documents and JSON-LD. `compare.js` fetches an ISBN search page, then at most three candidate product pages, with a 12-second timeout per request. The popup queries stores in parallel and renders partial results as each finishes. A generation token prevents stale results replacing newer searches. Storage writes are queued to avoid overwriting a later shelf action with an earlier save.

## Matching rules

Only valid ISBNs are accepted; ISBN-10 is normalized to ISBN-13. An offer must belong to a structured node carrying the same ISBN. Separate Book/Product fallback requires explicit page ISBN and exactly one Product on a non-search page. Open Graph price fallback also requires explicit ISBN. Aggregate `lowPrice`, non-EUR prices and external seller URLs are rejected. Availability is preserved; only `InStock` offers are eligible for the lowest-confirmed-in-stock marker.

## Store adapters

Wook uses `/pesquisa?keyword={isbn}`, Bertrand uses `/pesquisa/{isbn}`, and both use `/livro/` product links. Almedina uses the catalog search route and product paths. Wook and Almedina may redirect an exact ISBN search to a product. The final response must remain on the store origin. Wook omits currency in JSON-LD, so its adapter requires a matching ISBN and reads the explicit euro price in `#product-price .price` instead of unrelated recommendations. Bookcover uses the public WooCommerce Store API `/wp-json/wc/store/v1/products?sku={isbn}` and validates the returned SKU, EUR currency and minor units. Its ordinary search does not match ISBNs.

Routes and schemas may change. Blocks, unsupported schemas and invalid responses produce an unavailable/unverified row with a manual shop link. Automated tests use synthetic fixtures. A local real-extension smoke check on 2026-11-03 returned Bookcover ISBN 9789899267411 at 1800 cents; the other shops blocked extension requests in that environment. Browser inspection confirmed the matching Book/Product schemas and primary prices on Wook, Bertrand and Almedina for ISBN 9789895701124. These are point-in-time checks, not a guarantee of catalogue-wide compatibility. Run `node scripts/live-smoke.mjs` for an optional local network check; it pre-grants the four hosts only in a temporary test copy.

## Future work

Validate adapters against live pages and store terms before broad release. Add recorded, sanitized fixtures with date/provenance when permission permits. Add shipping-aware totals and loyalty-credit breakdowns before advertising total-price comparison. Background price alerts, campaign tracking, wishlist import and any legal discount timing require a separate design and validation step.

## Design

Ink `#172e59`, blue `#2458bb`, white `#ffffff`, mist `#eef3fc`, grey `#536278`, green `#16624a`. A small book-spine monogram anchors the header. Segoe UI carries controls and prices; Georgia gives book titles a literary feel. Prices align right, store names left, with one list rather than a grid of cards. Keyboard focus is visible; all dynamic merchant text is escaped through text nodes.
