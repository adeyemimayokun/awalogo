# Security Policy

Please report security issues privately by opening a GitHub security advisory
when the repository is hosted on GitHub.

Do not open public issues for malicious SVG payloads, package compromise, or
workflow vulnerabilities.

Upload and publication paths share strict XML/namespace and parsed CSS checks.
They reject scripts, event handlers, unsafe namespaces, entities, animation and
non-fragment resource references. Public artwork responses also use a sandboxed
Content Security Policy. Checksums establish integrity, not that untrusted SVG
content is safe; both controls are required.

Run `pnpm security:audit`, `pnpm test`, and `pnpm typecheck` before release.
The dependency gate fails closed on missing advisory data or unapproved findings.
See the [security remediation report](docs/security-remediation-2026-11-02.md)
and [database release requirements](docs/neon.md). Configuration patches are not
active on the live website until a separately verified deployment is released.
