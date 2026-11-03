# Changelog

## Unreleased

- Add opt-in automatic book-page detection and dismissible cheaper-offer notices, with exact-edition, stock, condition and currency checks.
- Run automatic comparisons independently of the popup, with bounded concurrency, short-lived caching and permission-aware registration.

- Expand the researched catalogue to 26 automatic adapters, 17 manual sources and 17 reference entries covering all stores and aliases in the source inventory.
- Add selectable shops, bounded parallel queries, cancellation and title-assisted exact-ISBN matching.
- Preserve currencies, seller conditions and marketplace distinctions in results and local history.
- Handle publisher ISBN fields, Unicode hyphens, displayed sale prices and Mundo Fantasma search data.
- Document live checks, access failures and store-specific limitations, with reconstructed parser fixtures and browser regression tests.

## 0.1.0

- Initial experimental Chrome extension with ISBN-based comparison, four store adapters, saved books and local observed-price history.
