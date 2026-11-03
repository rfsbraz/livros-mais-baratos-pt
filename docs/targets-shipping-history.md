# Targets, shipping and observed history

## Saved-book targets

Save a book and enter a target in euros, choosing either item price or delivered total. Only exact-ISBN, new, in-stock EUR offers from non-marketplace shops qualify. Delivered targets require known shipping for the selected destination. A first match produces a system notification and a persistent in-extension notice. The same price does not notify again; a lower qualifying price does. Editing a target resets this comparison.

A five-minute Chrome alarm selects the oldest due target. Starts are spaced at least ten minutes apart, with one saved book active at a time. Initial checks are due after one to five minutes; completed checks are next due after 24 hours plus up to 15 minutes of jitter. Sleeping/closed browsers delay checks, and missed work does not produce a simultaneous burst. No server runs checks when Chrome is closed.

The background worker persists a job token and target revision before asking the offscreen document to work. The document replies immediately, performs bounded comparisons, and sends a completion message that can wake a stopped worker. Results for removed, edited, disabled or cleared targets are rejected. Expired in-flight jobs become retryable after three minutes, subject to the ten-minute spacing. Changes to page-alert settings can close the offscreen document; an interrupted target job is then recovered through that persisted state.

The shelf and history are mutated through a serialized background queue. Manual comparisons merge observations into the latest history rather than overwriting scheduled results from a stale popup snapshot. Clearing data invalidates the in-flight token and disables scheduled checks. A notification click opens the extension, not an affiliate URL. Notifications may be blocked by the OS; the in-extension notice remains available.

## Shipping model

Estimates are for one book with standard delivery. Regions are mainland Portugal (default), Madeira, Azores and other destinations. Every automatic store supports a user-entered fee, free-shipping threshold, rule expiry and optional dated free-shipping promotion. Unknown shipping is null, never zero. Unknown totals cannot receive a cheapest-delivered badge or trigger a delivered-target alert.

The manual comparison defaults to delivered totals, with an item-price sorting option. On-page comparisons use totals when both relevant rules are known; an item-only fallback is explicitly labelled when shipping is unknown. Marketplace shipping, import charges, heavy parcels and paid extras are not inferred.

Initial published rules, verified 2026-11-03 and expiring after 30 days:
- Wook: standard delivery for mainland orders of at least EUR 16 is free; the fee below the threshold is unknown. Loyalty reimbursement is not deducted. Standard shipping to Madeira/Azores is free under the stated conditions. Maximum 10 kg, excluding marketplace items. [Source](https://www.wook.pt/Mensagem/index/?key=portes-gratis)
- Presença: mainland standard shipping EUR 3 below EUR 20, free above EUR 20. Exactly EUR 20 is left unknown because the published wording is ambiguous. Madeira/Azores EUR 4. [Source](https://www.presenca.pt/policies/shipping-policy)

Other stores initially remain unknown. These are editable estimates, not a checkout guarantee. Published rules retain source URLs, timestamps, conditions and expiry. User overrides are marked manual. An expired rule becomes unknown until reviewed, unless an independently valid promotion applies.

Promotion records require verified evidence, an explicit destination, minimum order value, start and end timestamps. They apply at the start boundary and stop at the end boundary. The current UI accepts user-confirmed promotions. Future page detectors can populate the same model after validating destination, scope, conditions and evidence; no automatic promotion scraping is implemented or claimed.

## Own observed data only

Charts use only book-price observations recorded by this extension installation during manual and scheduled comparisons. They never query third-party history, reuse the CI monitoring dataset, infer pre-installation prices or recalculate historical shipping using today's rules. Series are separated by store, currency and condition. Dots represent observations; lines merely connect those observations and do not assert prices between checks.

Each observation records source, time, price, currency, condition and availability. Limits remain 100 saved books, 200 ISBN histories, up to 360 observations per ISBN and a 90-day window pruned when that ISBN is updated. The display includes an accessible textual list of recent observations. A single observation is shown as a point, not a fabricated trend.
