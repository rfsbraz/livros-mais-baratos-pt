# Changelog

## Unreleased

- Default to six Portuguese shops while preserving saved selections and providing a reset-to-six button.

- Show locally cached background, scheduled and manual prices immediately in the menu, with freshness labels and explicit refresh.

## 0.1.5

- Add saved-book price targets, staggered scheduled checks and deduplicated notifications.
- Compare estimated delivered totals using destination-specific shipping fees, free-shipping thresholds and dated promotions.
- Draw history charts exclusively from locally observed manual and scheduled prices.
- Preserve concurrent shelf/history changes and invalidate pending jobs when data is cleared.

## 0.1.4

- Add optional affiliate support, enabled by default, for deliberate clicks on verified cheaper Wook offers.
- Disclose commissions in the interface and store listing; preserve opt-outs and existing attribution.

## Unreleased

- Default to six Portuguese shops while preserving saved selections and providing a reset-to-six button.

- Enable automatic comparisons on fresh installation with required access to the 26 configured shops, without opening the popup or an activation step.
- Preserve a saved disabled preference and refresh store screenshots, listing copy, privacy disclosures and install instructions.

- Add automatic book-page detection and dismissible cheaper-offer notices, with exact-edition, stock, condition and currency checks.
- Run automatic comparisons independently of the popup, with bounded concurrency, short-lived caching and permission-aware registration.

- Expand the researched catalogue to 26 automatic adapters, 17 manual sources and 17 reference entries covering all stores and aliases in the source inventory.
- Add selectable shops, bounded parallel queries, cancellation and title-assisted exact-ISBN matching.
- Preserve currencies, seller conditions and marketplace distinctions in results and local history.
- Handle publisher ISBN fields, Unicode hyphens, displayed sale prices and Mundo Fantasma search data.
- Document live checks, access failures and store-specific limitations, with reconstructed parser fixtures and browser regression tests.

## 0.1.0

- Initial experimental Chrome extension with ISBN-based comparison, four store adapters, saved books and local observed-price history.
