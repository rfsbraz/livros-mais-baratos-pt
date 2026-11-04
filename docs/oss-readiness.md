# Open-source preparation

Prepared on 4 November 2026. This work prepares the extension for a public MIT-licensed repository. It does not change repository visibility, merge pull requests, publish browser-store listings or deploy a website.

## History decision

**No history rewrite is warranted by the audit findings.** The audit fetched branches, tags and available pull-request heads, including closed PRs. At the start of the audit, 34 commits were reachable and 384 unique file blobs totalled approximately 2.61 MB. The largest blob was a 93 KB demonstration screenshot. There were no tracked upload archives, browser profiles, credential files or complete private page captures in that inventory.

Gitleaks 8.30.1, downloaded from its official release and verified against the release checksum, scanned all fetched history with redaction enabled and found no secrets. The scanner reported 33 scanned commits (Git counts 34 reachable commits, including the merge). An additional historical text-blob pass found no local user-directory paths or private-key/token patterns. Normal Git author attribution and the intentionally disclosed Wook affiliate ID are retained.

This is an audit of fetchable repository content, not proof that no sensitive data exists anywhere. It does not inspect inaccessible server objects, personal browser profiles, GitHub secret values or private accounts. Rewriting clean history would invalidate commit references and complicate existing PRs without addressing an identified exposure. If a real credential is found later, revoke it first, then remove it from every relevant ref and address cached PR references as needed.

## Findings addressed

| Finding                                                                  | Change                                                                                                                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vulnerable minimatch 10.2.6 in the lint dependency graph                 | Override to patched 11.0.1 and regenerate the lockfile. Initial npm audit reported five affected dependency nodes for one underlying advisory; the corrected graph reports zero vulnerabilities. |
| Security reports relied on a private-repository issue                    | Provide a stable private email channel and an issue-form link; never direct reporters to public issues.                                                                                          |
| Contributor setup described obsolete releases and Chrome-only testing    | Document forks, credential-free setup, all three browsers, shop fixtures, licensing and actual release automation.                                                                               |
| No recurring secret/dependency security jobs                             | Add pull-request, main and weekly checks using a checksum-pinned scanner and npm audit, including development dependencies.                                                                      |
| Required compatibility checks could be skipped after an upstream failure | Make unit/browser gate jobs explicitly fail when their upstream pipeline fails.                                                                                                                  |
| Public-maintainer conventions incomplete                                 | Add code ownership, editor/line-ending settings, stronger secret/capture ignore patterns, repository metadata and third-party notices.                                                           |

The dependency override is temporary because the current lint packages still request minimatch 10.x. Remove it when upstream resolves a patched release and lint/audit checks remain green. Advisory: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Security and licensing scope

Reviewed the extension's remote-page parsing and rendering, credential-free shop requests, sender validation for background messages, origin checks, bounded request scheduling, build allowlist and GitHub workflow permissions. Pull-request tests run without publishing credentials. The privileged PR-comment workflow does not check out or execute PR code. Browser fixtures and development tools are excluded from install ZIPs.

The MIT license remains unchanged. There are no npm runtime dependencies. Locked development packages declare permissive license identifiers, documented in [third-party notices](../THIRD_PARTY_NOTICES.md). Original artwork and synthetic test/demo responses are distinguished from third-party retailer content.

These checks reduce risk but are not a penetration test, a legal opinion or a guarantee of security. Shop adapters remain experimental; live access and price correctness require continued maintenance.

## Public-launch settings

The repository is still private. GitHub returned HTTP 403 when reading main-branch protection, explaining that the current private-repository plan does not support it. Private vulnerability reporting was also unavailable for this private repository. Dependency vulnerability alerts are enabled.

After the owner chooses to make the repository public and the new checks have run on main:

```sh
npm run repo:configure
npm run repo:configure -- --apply
```

The first command is an offline preview. The second requires an authenticated repository administrator and a public repository. It applies the checked-in branch-protection policy, enables vulnerability alerts and enables private vulnerability reporting. It never changes visibility, secrets, branch contents or store publication.

The policy requires up-to-date `unit`, `browser`, `secret-scan` and `dependency-audit` checks; applies to administrators; disallows force pushes and deletion; and requires conversation resolution. Pull requests are required, but zero external approvals allows the solo maintainer to merge after checks pass. Review branch protection after any workflow/job rename. GitHub secret scanning and push protection should also be enabled in the public repository's security settings when available.

Merge the store automation PR before this preparation PR, then rerun the release checks. Store listing IDs, publisher credentials and public privacy/support URLs remain separate requirements for browser-store submission; see [store setup](../store-listing/AUTOMATION.md). They are not required for OSS contributors to build and test locally.

## Verification

Verified locally: 33 unit tests and all three native browser suites pass, along with lint, formatting, manifest checks, all-browser builds, listing validation and submission-pack generation. The final dependency audit reports zero vulnerabilities. Use the checks in [CONTRIBUTING.md](../CONTRIBUTING.md), plus `npm run store-listing:pack`. The preparation branch is verified against the patched lockfile, rather than merely editing dependency declarations. CI repeats unit/browser checks and the new security scans on subsequent changes. History and dependency audit reports contain no secret values and are kept outside the source tree.
