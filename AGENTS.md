# Project conventions

This is a browser-only Manifest V3 extension written in JavaScript. Keep it private unless the owner explicitly requests publication. The MIT license does not change repository visibility.

- Use Node.js 22+, plain ES modules and two-space indentation.
- Follow the owner's conventional commit and PR rules. Never add attribution footers or use em dashes.
- Run `npm run check`, `npm run test:coverage`, `npm run test:integration` and `npm run build` for functional changes.
- Runtime has no dependencies, server, Python or container. CI uses Node/browser checks and ZIP artifacts; Docker image publishing and Docker PR instructions do not apply to this project.
- Treat store data as untrusted. Do not use innerHTML, eval, remote scripts, unrestricted host permissions or captcha workarounds.
- Match exact ISBN and currency. Do not convert loyalty credit into an immediate discount.
- Keep live store checks separate from deterministic CI. Document observed failures honestly.
- Never commit test browser profiles, scraped full pages, credentials or personal data.
