# Store metadata and automation

This follows the Geocaching extension's release, listing sync, credential checks and weekly drift workflow. The repository remains private. No store account, public listing or website is created by these scripts.

## Source and generated pack

- `listing.json`: shared settings, public store IDs/URLs and public website URLs.
- `locales/pt-PT.json` and `locales/en.json`: editable summaries, descriptions, search terms and screenshot order. English is listing copy, not an English interface.
- `screenshots/`: five 1280x800 captures of real extension components with labelled illustrative prices.
- `icons/`: 16 through 1024px; use 128px for Chrome/Firefox and 300px for Edge.
- `promo/`: Chrome 440x280 tile and 1400x560 marquee.
- `metadata/` and `website/`: generated disclosures, reviewer instructions and ready-to-host privacy/support pages.
- `CHROME_UPDATE.md` and `EDGE_UPDATE.md`: generated text to paste into store dashboards.

```sh
npm ci
npx playwright install chromium
npm run store-listing:assets
npm run store-listing:check
```

The complete pack is `dist/livros-mais-baratos-pt-VERSION-store-assets.zip`, with one folder per store, both listing languages, ordered screenshots, icons, disclosures, release notes and SHA-256 checksums. Browser install ZIPs are separate. Rebuild the pack without recapturing images with `npm run store-listing:pack`. CI validates listing limits, screenshot dimensions, and builds the pack. Releases attach it alongside the three browser ZIPs.

## What runs automatically

| Job               | Behaviour                                                                                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release           | Release Please creates version PRs; a completed release builds the tagged code and submits enabled stores. Manual dispatch selects an existing tag and stores.                                                                                 |
| Firefox listing   | A main-branch change to listing source syncs Portuguese and English text when Firefox publishing is enabled. Manual runs preview offline unless apply is selected.                                                                             |
| Firefox release   | Checks whether AMO already has the version, uploads only when missing, then updates changelog release notes and screenshots. Identical screenshot pixels are reused; new screenshots upload before old ones are removed. Rate limits back off. |
| Edge release      | Uploads the package with reviewer steps plus that version's changelog as certification notes.                                                                                                                                                  |
| Store drift       | Weekly public checks compare both listing languages. One issue per store is opened/updated on drift and closed when clean. Unreadable pages are errors, not evidence of drift.                                                                 |
| Store credentials | Weekly checks for enabled stores, including Edge key expiry. Existing issues are reused and resolved after recovery.                                                                                                                           |

Chrome and Edge listing text and images still use the dashboards, matching the reference extension. Their documented APIs update packages, not the full listing artwork. Firefox supports listing and preview changes through AMO. Initial store registration, account verification and the first listing require the relevant dashboard.

## One-time account setup

No publishing variables or secrets were configured in this repository when this work was prepared. Do not copy credentials into files, issues or chat. Add them in GitHub Actions settings:

| Store    | Repository variables                                                        | Repository secrets                                                 |
| -------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Releases | none                                                                        | `RELEASE_PLEASE_TOKEN`                                             |
| Chrome   | `CHROME_PUBLISH_ENABLED=true`, `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID` | `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` |
| Firefox  | `FIREFOX_PUBLISH_ENABLED=true`                                              | `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`                                 |
| Edge     | `EDGE_PUBLISH_ENABLED=true`, `EDGE_API_KEY_EXPIRES` (ISO date)              | `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`                |

Use repository-scoped secrets because the weekly credential check does not select a store environment. Release jobs retain the `chrome-store`, `firefox-store` and `edge-store` environments for optional protection rules. Leave a store disabled until its initial submission exists and its credentials are ready. The Firefox GUID is `livros-mais-baratos-pt@rfsbraz.github.io`.

Enter public listing URLs and Chrome/Edge public listing IDs in `listing.json` to enable drift monitoring. Edge's public extension ID is not the Partner Center product ID. Add your public HTTPS privacy/support/homepage URLs in the same file and regenerate the pack. The private GitHub repository is not a usable public privacy URL. Contact email is `rfsbraz@proton.me`.

Preview safely with `npm run store-listing:amo` (no requests), `npm run store-listing:edge-notes` (no requests), and `npm run store-listing:release` (read-only AMO requests). Nothing is published by building the pack or opening a PR.

## Official API references

- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/api/reference/rest)
- [Microsoft Edge Add-ons API](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/addons-api-reference)
- [AMO listing and preview API](https://mozilla.github.io/addons-server/topics/api/addons.html)

The existing repository's Node release versioning and browser-only CI are retained, as specified in its project conventions. Action-version upgrades already have separate dependency PRs and are not bundled here.
