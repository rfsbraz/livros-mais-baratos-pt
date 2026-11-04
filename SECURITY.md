# Security policy

| Version          | Supported         |
| ---------------- | ----------------- |
| 0.1.x            | Yes, experimental |
| Earlier versions | No                |

Report vulnerabilities to **rfsbraz@proton.me**, or use **Security > Report a vulnerability** when available. Do not use public issues or discussions for unpatched vulnerabilities. The email channel remains available regardless of GitHub repository visibility.

Include reproduction steps, affected version and impact. Avoid real credentials and personal data. Target initial response: seven days; remediation timing depends on severity and maintainer availability.

The extension does not execute merchant HTML/scripts, send session cookies, or request unrestricted host access. Normal search redirects are followed without credentials; responses with a final origin outside the requested shop are rejected. Remote content is untrusted. Prices and links must remain bound to a validated ISBN and allowed HTTPS store origin.

CI scans fetched Git history for secrets and audits development dependencies on pull requests, main pushes and weekly. No npm runtime dependencies are shipped. A clean scan is not a guarantee that every vulnerability has been found. See [the OSS preparation report](docs/oss-readiness.md) for the initial audit scope and limitations.
