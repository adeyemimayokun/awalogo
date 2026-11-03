# Dependency Security Policy

Run `pnpm security:audit`. It queries the npm advisory service through pnpm and
fails closed on unavailable or malformed audit data and on every non-exempt
advisory, including low severity. Critical advisories cannot be exempted.
Save a report with `pnpm security:audit --output /tmp/audit.json`; replay it
with `node scripts/dependency-audit.mjs --input /tmp/audit.json`.

The exception list is empty. Future exceptions require exact GHSA, package,
installed version and dependency path, a reachability assessment, source and
expiry in `dependency-audit-exceptions.json`. Expired records fail the gate.
There are no blanket ignores or SDK reachability exceptions.

## 2026-11-02 Baseline

- Sharp is pinned to 0.35.5. Local native libraries: libvips 8.18.7,
  libheif 1.23.5, librsvg 2.63.2. Verify deployed binaries independently.
- Vite 7.3.7, React plugin 5.2.0 and Vitest 4.1.12 are compatible maintained
  versions. Vitest no longer brings in vulnerable Tinypool. Node >=22.13 and
  pnpm 11.25.0 align the supplied executable and CI.
- SheetJS uses the official 0.20.3 tarball, not stale npm xlsx 0.18.5.
  Its integrity is locked; import APIs are unchanged. Dependabot may not update
  URL dependencies, so periodically check the official distribution.
- All application/workspace Zod declarations pin 4.6.7. The record schema in
  api/_lib/catalog.ts explicitly validates string keys and variation-array values.
  Regression tests cover request defaults, trimming, strict event fields,
  oversized mutation collections and malformed variation records.
- The only override patches Zod 4 to 4.6.7 under @vercel/cli-config, whose
  upstream package pins an affected 4.1.11. This is parent-scoped and same-major;
  no Zod 3-to-4 override exists.
- The unused @vercel/node SDK was removed entirely, including its builder,
  tracing and HTTP dependency tree. API type imports now refer to local
  api/_lib/vercel-types.ts: Node IncomingMessage plus parsed query/body and
  ServerResponse plus the platform's status/json/redirect helpers. No runtime
  adapter was added or altered.
- Runtime sax 1.6.1 and css-tree 3.2.1 support direct SVG parser imports and NFT
  tracing. SVG policy and publishing-cache changes are owned separately.

## Verification And Preservation

The npm registry reports captured through pnpm are
`/tmp/awalogo-sec-deps-before.json` and `/tmp/awalogo-sec-deps-after.json`.
The original report had 101 advisory records: 3 critical, 45 high, 45 moderate,
8 low. The final live report has zero advisories at every severity, zero
exceptions, and zero blocked paths. The exact CI gate exits successfully.

The final unfiltered suite passed 473 tests across 94 files, and the TypeScript
project build (`tsc -b`) passed. Results are recorded in /tmp/awalogo-sec-full-tests-zod4.log and
/tmp/awalogo-sec-typecheck-zod4.log. Dependency-policy checks run separately
with `node --test scripts/dependency-audit.checks.mjs` (four passed). The final
frozen-lockfile, ignore-scripts installation also passed.

Do not regenerate assets to make dependency checks pass. The user's snapshot
/tmp/awalogo-pre-security-assets.json covers 5,459 files whose bytes must remain
unchanged. Encoder upgrades can change bytes: the publishing worker's cache
reuses outputs only when source checksums, effective render options, frozen
format records and actual output checksums all match. New or changed inputs
must still validate and render. No asset/catalog outputs were refreshed by
this dependency migration. Deployment-native binary verification remains an
operational follow-up, not an advisory suppression.
