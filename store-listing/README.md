# Chrome Web Store submission pack

Livros Mais Baratos PT · 0.1.5 · Prepared 3 November 2026

## Upload map

| Dashboard field | File |
|---|---|
| Extension package | upload/livros-mais-baratos-pt-0.1.5-store.zip |
| Store icon | icons/icon-128.png |
| Screenshots, in order | screenshots/01... through 05... (1280×800 each) |
| Small promotional tile | promo/small-440x280.png |
| Marquee promotional tile | promo/marquee-1400x560.png |
| Name and short summary | metadata/listing-pt-PT.txt |
| Detailed description | metadata/description-pt-PT.txt |
| Optional English listing | metadata/description-en.txt (UI remains Portuguese) |
| Privacy and permission answers | metadata/privacy-and-permissions.md |
| Reviewer instructions | metadata/reviewer-notes.txt |
| Support email | rfsbraz@proton.me |
| Category and language | Shopping; Portuguese (Portugal) |

## Before submission

Host the three files in website/ on a public HTTPS site. Enter the privacy.html URL in the dashboard; support.html can be the support URL and index.html the website URL. These URLs are intentionally null in listing.json because no domain has been supplied. Do not use the private repository as a public support or privacy link. No public deployment or store submission has been performed.

Confirm your publisher account/contact verification, distribution visibility and countries in the developer dashboard. A private source repository does not determine Chrome Web Store listing visibility. The optional YouTube video is not included or required for this pack.

## Asset details

Five screenshots use real extension components with illustrative ISBN/price responses, labelled on each image. They are demonstration captures, not live-price evidence. The book-cover block is an original text-only demonstration design, not the published cover. The notification screenshot is composed around the real notification component; its position/width are adjusted for presentation. No retailer logos, Chrome logos, rankings, endorsements or review stars are used.

The 128px icon uses 96px artwork with transparent padding. Other icon sizes, editable SVG, promotional HTML and the generation script are included. Screenshot and promo exports are opaque PNGs. asset-manifest.json records their pixel dimensions.

The upload ZIP contains production code from 0.1.5 with matching icons and the same summary as the repository manifest. It excludes screenshots, fixtures, development files and credentials. source/extension/ contains the exact upload source. The production code, store metadata generators and screenshots are updated together for automatic-by-default behavior.

The source HTML layouts reference a local capture server for the popup and are editable design references, not public web pages. Run npm run build, node scripts/store-assets.mjs and node scripts/store-metadata.mjs from the project checkout with Node and Playwright to reproduce this pack. The website/ folder is self-contained and ready to host.

## Official specifications checked

- [Listing fields and image dimensions](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Icon padding and image formats](https://developer.chrome.com/docs/webstore/images)
- [Screenshot and promotional guidance](https://developer.chrome.com/docs/webstore/best-listing)
- [Manifest description length](https://developer.chrome.com/docs/extensions/reference/manifest/description)
- [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Local processing and user-data disclosure](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
