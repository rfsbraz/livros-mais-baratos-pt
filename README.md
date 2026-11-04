# Livros Mais Baratos PT

[![CI](https://github.com/rfsbraz/livros-mais-baratos-pt/actions/workflows/ci.yml/badge.svg)](https://github.com/rfsbraz/livros-mais-baratos-pt/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A browser extension for Chrome, Firefox and Edge that compares book prices across Portuguese bookshops. Find the same edition by ISBN, see cheaper offers automatically, and track prices for books you want to buy. The interface is in Portuguese (Portugal).

![Automatic cheaper-offer notice with illustrative prices](store-listing/screenshots/01-aviso-automatico-1280x800.png)

_Screenshot uses illustrative prices, not live offers._

## Features

- **Automatic cheaper-offer alerts** - Visit a supported book page and see a notice when another selected shop has the same new edition in stock for less. No popup or initial setup is needed after granting site access.
- **Six shops by default** - Wook, Bertrand, Almedina, Continente, Porto Editora and Presença keep comparisons focused. Choose from 26 automatic adapters in **Definições**; saved selections survive updates.
- **Compare the same edition** - Validates ISBN-10 and ISBN-13, checks product pages and keeps used books, other currencies and unknown availability separate from confirmed new EUR offers.
- **Prices ready when you open the menu** - Recent background, scheduled and manual results are cached locally, with the time checked and an indication when they may be outdated.
- **Shipping estimates** - Configure delivery fees, free-shipping minimums and dated promotions, with mainland Portugal as the default destination. Unknown shipping is never treated as free.
- **Saved books and target alerts** - Save up to 100 books, set item-price or delivered-price targets, and receive notifications from approximately daily checks while the browser is running.
- **Your own price history** - Charts use only prices observed by this installation. Preferences, saved books, cache and history stay in your browser, with a setting to erase them.
- **Separate settings** - Search, prices and saved books stay in the main view. Shop selection, shipping, alerts and affiliate preferences live in **Definições**.

See [shop coverage](docs/store-coverage.md) for all automatic adapters, manual sources and reference entries, and [targets, shipping and history](docs/targets-shipping-history.md) for calculation rules.

## Installation

### Browser Extension Stores

The extension is not yet published on the Chrome Web Store, Firefox Add-ons or Edge Add-ons. Store links will be added when listings are available. You can build from source using the instructions below.

### Manual Installation

#### Chrome / Edge

1. Obtain the matching `-chrome.zip` or `-edge.zip` package from the supplied download or a successful [CI run](https://github.com/rfsbraz/livros-mais-baratos-pt/actions/workflows/ci.yml) (`extension-package` artifact).
2. Extract the browser package into a folder.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
5. Grant the requested site access and visit a book page in one of the selected shops.

No Node.js installation is needed to load a prepared package. To build from a checkout, follow the development instructions below.

#### Firefox

1. Obtain and extract the `-firefox.zip` package.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on** and select the extracted `manifest.json`.
4. Grant the requested site access and data-transmission permissions.

Firefox 140 or later is required. Temporary add-ons are removed when Firefox restarts. Normal installation requires a Mozilla-signed package, which is not yet provided.

## Usage

1. Visit a supported book product page in a selected shop. If the ISBN and current price can be verified, the extension compares offers in the background and shows a dismissible notice for a qualifying cheaper edition.
2. Open the extension icon to view cached prices or compare manually. Confirm or enter the ISBN and choose **Comparar** to refresh results. Keep the menu open during a manual comparison.
3. Choose **Guardar** to save a book. Set a target based on the item price or estimated delivered total, and view the history of your own manual and scheduled observations.
4. Open **Definições** to choose shops, configure **Entrega e portes**, change alert or affiliate preferences, or erase local data. **Voltar aos preços** returns to the same results.

### Prices, shipping and availability

Automatic notices compare new books in EUR with confirmed stock, excluding shipping. They do not appear on search pages or for identified used books, digital formats or marketplace offers. A notice is not guaranteed: prices, stock and shop access change.

Shipping estimates use your current rules. Initial verified rules are supplied for Wook and Presença and expire after 30 days; other shops need a rule before a delivered total can be estimated. Free-shipping promotions are entered manually. Automatic promotion detection is not implemented. Import charges and loyalty credit are not included as immediate savings.

Cached results cover up to 50 ISBNs. Results older than ten minutes are marked potentially outdated; results older than 24 hours are hidden and pruned on the next write. Viewing cached prices does not create a history observation. Automatic page alerts do not add history observations either. History is limited to 90 days, 200 editions and 360 observations per edition.

The adapters are experimental. On 3 November 2026, local live checks confirmed prices in 18 of the 26 automatic shops; eight did not complete requests in that environment. A successful sample does not guarantee the whole catalogue. Failed shops retain a manual link and never receive an invented price. See the [coverage report](docs/store-coverage.md) for evidence and limitations.

### Privacy and permissions

Site access is requested at installation and remains under the browser's control. Automatic alerts are enabled by default, and a saved preference to disable them is preserved. Each queried shop receives the ISBN and, when needed, title, together with normal network information such as your IP address. Comparison requests omit session cookies. There is no telemetry or external price-history service.

`activeTab` supports manual detection; `scripting` supports automatic detection on authorized shops; `storage` keeps local data; `alarms` schedules target checks; and `notifications` shows system alerts. Chrome and Edge use `offscreen` for background parsing. Firefox uses a local background page and parser frame. The extension does not bypass captchas, sign into shop accounts or execute downloaded scripts.

Wook affiliate links are enabled by default and can be disabled in **Definições**. The affiliate code is added only when you deliberately click an eligible confirmed cheaper Wook offer. It does not affect comparisons, ranking or background requests. See the [privacy policy](PRIVACY.md).

## Development

### Prerequisites

- Node.js 22.13 or later
- npm
- Repository access

### Setup

```sh
# Clone the repository
git clone https://github.com/rfsbraz/livros-mais-baratos-pt.git
cd livros-mais-baratos-pt

# Install dependencies and test browsers
npm ci
npx playwright install chromium firefox msedge
```

On Linux, add `--with-deps` to the Playwright installation command to install browser system dependencies.

### Commands

```sh
# Run linting and formatting checks
npm run lint
npm run format:check

# Fix linting and formatting
npm run lint:fix
npm run format

# Validate the extension and run unit tests with coverage
npm run check
npm run test:coverage

# Build all browser folders and ZIP packages
npm run build:all

# Run native Chromium, Firefox and Edge tests after building
npm run test:e2e

# Rebuild store metadata and demonstration screenshots
npm run store-listing:assets
npm run store-listing:check
```

`npm run build` and `npm run build:zip` build Chrome. `npm run build:firefox` and `npm run build:edge` build individual browsers. Packages are written to `dist/`.

### Loading for Development

1. Run `npm run build:all`.
2. Open `chrome://extensions`, `edge://extensions` or `about:debugging#/runtime/this-firefox`.
3. For Chrome or Edge, enable **Developer mode**, choose **Load unpacked**, and select `dist/chrome` or `dist/edge`.
4. For Firefox, choose **Load Temporary Add-on** and select `dist/firefox/manifest.json`.
5. After editing source files, rebuild and reload the extension in the browser.

Runtime files live at the repository root, tests in `tests/unit` and `tests/e2e`, build tooling in `scripts`, and store materials in `store-listing`. There is no server or runtime dependency. Firefox's content entry point is bundled during the build. See [architecture](docs/architecture.md) and [cross-browser builds and publishing](docs/reference-alignment.md).

CI runs lint, formatting, unit tests, all-browser builds, native browser tests, dependency audits and full fetched-history secret scans. Separate live shop monitoring spreads the 26 shops across 24 hourly slots with jitter and tracks failures in issues. See [shop monitoring](docs/store-monitoring.md). Store publishing remains gated until this extension's listing IDs, credentials and public privacy/support URLs are configured.

## Store listings

The [store submission pack](store-listing/README.md) includes Portuguese and English metadata, five screenshots, browser-store icons, promotional images, privacy disclosures and reviewer instructions. [Automation and account setup](store-listing/AUTOMATION.md) follows the Geocaching extension: tagged releases for Chrome, Firefox and Edge, Firefox text/screenshot synchronization, changelog-based reviewer notes, and weekly credential and listing-drift checks.

| Compare delivered prices                                                                          | Track your own observations                                                                                 |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ![Comparison with illustrative prices](store-listing/screenshots/02-comparar-edicao-1280x800.png) | ![Local price history with demonstration data](store-listing/screenshots/04-estante-historico-1280x800.png) |

Run `npm run store-listing:assets` to regenerate the images and per-store ZIP. Releases attach the pack alongside the browser packages. Chrome and Edge listing artwork/text still use the dashboards; Firefox can synchronize these through its API. Publishing remains disabled until this extension's accounts and credentials are configured.

## Contributing

Contributions are welcome: bug reports, accessibility improvements, documentation and well-tested shop adapters. Read the [Contributing Guide](CONTRIBUTING.md) for setup, checks and pull request conventions. Code is available under the MIT license; retailer names and third-party content remain their owners' property.

## Security

For security concerns and private reporting instructions, see the [Security Policy](SECURITY.md).

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

- [Geocaching Friends Logs](https://github.com/rfsbraz/Geocaching.com-Friends-Logs) provides the reference repository and workflow structure.
- [Playwright](https://playwright.dev/) and [playwright-webextext](https://github.com/ueokande/playwright-webextext) support browser testing.

## ☕ Support

If you find this useful and want to support development, you can [buy me a coffee](https://buymeacoffee.com/rfsbraz) - no pressure at all, just a nice way to say thanks.
