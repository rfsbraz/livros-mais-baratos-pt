# Third-party notices and content

## Project code and artwork

Project source, original icons and promotional layouts are distributed under the [MIT license](LICENSE). The store release helpers were adapted from [Geocaching.com Friends Logs](https://github.com/rfsbraz/Geocaching.com-Friends-Logs), another MIT-licensed project by the same maintainer.

Screenshots use actual extension components with synthetic responses and labelled illustrative prices. The demonstration book-cover block is a text-only design, not a reproduction of a published cover. The repository does not include retailer logos, full book texts or complete authenticated retailer pages.

Retailer names, book titles, ISBNs and public URLs identify supported sources and examples. They do not imply endorsement. Retailer content and trademarks remain subject to their owners' rights; the project's MIT license does not grant rights to third-party content obtained while using the extension.

## Development tools

The extension runtime ships no npm dependencies. Builds use an explicit file list; testing tools, downloaded browser binaries, node_modules and development credentials are excluded from browser ZIPs.

The locked development dependency graph records these license identifiers: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, BlueOak-1.0.0 and 0BSD. These are package metadata, not a replacement for each package's license text. The lockfile identifies exact versions and registry integrity hashes; installed packages retain their own license/notice files.

Direct tools include ESLint and its configuration, Playwright, playwright-webextext, esbuild, Prettier, globals and tslib. Gitleaks is downloaded for CI and history audits only and is not part of the extension. Browser executables installed for tests have their own licenses and are not redistributed in this repository's packages.

When adding a dependency or vendoring source, record its license, preserve required notices and verify whether it is shipped to users. Do not assume a development-tool license covers downloaded retailer content.

## Affiliate disclosure

The public Wook affiliate identifier in `affiliate.js` is an attribution identifier, not a credential. Optional affiliate links are enabled by default and can be disabled in settings. They do not change comparison requests or ranking. Fork maintainers should review both the identifier and the matching user-facing disclosures before distributing their own build.
