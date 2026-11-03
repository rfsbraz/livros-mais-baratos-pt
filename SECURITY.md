# Security policy

| Version | Supported |
| --- | --- |
| 0.1.x | Yes, experimental |
| Earlier versions | No |

Report vulnerabilities privately through the repository's **Security > Report a vulnerability** option when enabled. While this repository is private, collaborators may open a private repository issue marked `security`, visible only to those with repository access. Do not post vulnerabilities publicly. Before making the repository public, enable GitHub private vulnerability reporting and replace this private-issue fallback.

Include reproduction steps, affected version and impact. Avoid real credentials and personal data. Target initial response: seven days; remediation timing depends on severity and maintainer availability.

The extension does not execute merchant HTML/scripts, send session cookies, or request unrestricted host access. Normal search redirects are followed without credentials; responses with a final origin outside the requested shop are rejected. Remote content is untrusted. Prices and links must remain bound to a validated ISBN and allowed HTTPS store origin.
