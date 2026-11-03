# Security Remediation And Repeat Review

| Patched-source review | Remaining confirmed findings |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

Reviewed 2026-11-02 using the installed security-review skill. These results describe
the patched working tree, not a new live deployment. Production configuration,
database credentials and deployed native binaries have not been changed by this work.

## Approved Findings

| Finding | Remediation |
|---|---|
| SEC-01 SVG active content | Shared strict XML/namespace and parsed CSS policy at upload, rendering, publication and plugin resource generation. Non-fragment references, script/animation/foreign content, entities and malformed XML fail closed. Safe existing CSS and bounded PNG wrappers remain compatible without rewriting source bytes. |
| SEC-02 Native image decoder | Sharp 0.35.5 and patched native libraries. Uploaded data still has byte/pixel limits; format mismatches are rejected. Existing output bytes remain pinned, not regenerated. |
| SEC-03 Request abuse | Atomic PostgreSQL network/recipient/global quotas, HMAC identifiers, authenticated idempotency, storage leases and delivery fencing. Deployed requests fail closed if protection is unavailable. |
| SEC-04 Dependencies | Patched Vite/Vitest, SheetJS from its official distribution, reviewed Zod 4 schema migration, and removal of the unused Vercel builder SDK. CI advisory gate fails closed; no current exceptions. Weekly dependency updates configured. |
| SEC-05 Notification authorization | Resolve the notification and verify repository membership before mutation, using the same credential. Request/notification mutations also require the correct Origin. |
| SEC-06 Response headers | Application CSP, nosniff, frame restrictions, no-referrer and permissions restrictions. Public artwork has a sandboxed CSP while retaining immutable caching and plugin CORS. |
| SEC-07 Database privileges | Explicit non-owner, non-bypass-RLS runtime-role provisioning and command/column-specific grants. Rollback-only staging rehearsal; production role/credential activation remains a release step. |
| SEC-08 Telemetry privacy | Both analytics SDKs share production-origin, normalized private-route and privacy guards. Send-time filtering strips URL queries/fragments and drops private navigation events. |

The repeat review found one additional expiry-boundary race: claim reclamation
could overwrite a concurrent delivery transition. The admission procedure now
locks the receipt with SELECT FOR UPDATE before evaluating its phase, serializing
reclamation with delivery updates. Lease IDs also fence stale handlers. Regression
checks cover lock ordering, stale ownership, storage failure/recovery, concurrent
retries, and uncertain delivery replay. See [request admission](public-logo-requests.md).

Malformed cookie encoding now fails closed without throwing, encrypted sessions
require at least a 32-character secret, and outbound GitHub/Resend requests have
timeouts. No authentication, authorization or body validation was removed when
replacing the SDK's erased TypeScript types with local platform interfaces.

## Verification

- Full Vitest suite: **475 tests passed across 94 files**.
- TypeScript project build: **passed**.
- `npm run build`: **passed**, including website, plugin UI/controller and plugin validation.
- Catalog/institution validation: **passed**; format consistency check: **passed**.
- Dependency audit: **101 advisory records before, zero after**, including zero criticals,
  zero accepted exceptions and zero blocked paths. Gate output:

```json
{"vulnerabilities":{"info":0,"low":0,"moderate":0,"high":0,"critical":0},"acceptedPaths":0,"blockedPaths":0}
```

- Offline dependency/provisioning checks: **15 passed**. One separate local-PostgreSQL
  integration check is explicitly skipped; staging verification is provided separately.
- Staging runtime rehearsal: **29 checks passed**, including invocation of application
  procedures, restricted-role request/report/snapshot operations, denied DDL and private
  access, quota limits and token/lease replay. All schema/role/policy/fixture changes
  were rolled back and absence checks passed. No production database was targeted.
- Browser smoke test against the production build with configured response headers:
  search, 20-result pagination, logo/flag previews and mobile/dark-mode rendering passed;
  zero application CSP violations or runtime errors. The former namespace-script
  fixture is rejected at upload and blocked on direct SVG navigation by CSP.
- All **5,459** captured asset/catalog files remain byte-identical. The existing
  legacy baseline separately confirms **1,703** protected files unchanged.
- Credential-pattern scan covered **478** tracked/new text files: four credentialed
  URL candidates were synthetic test fixtures, not usable credentials. Only
  `.env.example` is tracked; actual environment files remain ignored.

Non-blocking upstream source-map/annotation and large-chunk warnings remain. They
did not fail tests or builds. No native memory-corruption exploit, load test, live
submission/email, GitHub issue creation or production deployment was attempted.
The two-connection lease-boundary race was source-reviewed and fenced, but not
executed against committed fixtures: the staging rehearsal deliberately keeps all
new objects uncommitted and rolls them back.

## Release Requirements

Do not deploy the new request handler before its database migration and secret
are configured: missing admission protection intentionally returns 503.

1. Follow [Neon provisioning](neon.md) on staging first: apply pending migrations as
   the existing migration owner, then create the separate runtime login. Provisioning
   refuses existing roles and output files; it does not rotate existing credentials.
2. Install the runtime DATABASE_URL and an independently generated server-only
   LOGO_REQUEST_ABUSE_SECRET of at least 32 characters in the matching Vercel environment.
   Keep owner DATABASE_URL_UNPOOLED only in local/migration automation, not the API
   runtime. Remove any other owner-credential aliases from runtime configuration.
3. Deploy a preview and verify request persistence/tracking, quotas, reports, admin
   triage, mixed downloads, privacy guards and headers. Keep preview email/issue
   delivery disabled. Verify deployed Sharp/native versions, not only local packages.
4. Release production separately after staging validation. Retain migration-owner
   access and prior deployment information for controlled rollback. No automatic
   production promotion or credential switch is part of this patch application.

The runtime login intentionally grants the trusted server its required row access;
it is not a per-user tenant isolation system. HTTP authorization and private tokens
remain mandatory. Rerun `pnpm security:audit`, `pnpm test`, `pnpm typecheck`,
`npm run build` and the documented staging rehearsal before release.

## Deployment Compatibility Follow-Up

On 2026-11-03, a clean-checkout release build exposed an ignored-output dependency
in the preservation cache. Existing reviewed output bytes are now versioned in
`packages/brands/published-assets`, under their original checksums. Fresh builds
restore those bytes without changing catalog records or re-rendering logos.
Corrupt output still fails closed; only missing generated files use the archive.
The clean release build and archive fallback regression test pass.

Neon role creation was also verified through a real committed provisioning and
TLS login on staging. Neon requires the generated password rather than a SCRAM
verifier in role-creation SQL; the provisioner uses verified TLS, escapes the
literal, and never prints credentials. The restricted role remains non-owner,
NOBYPASSRLS, and NOCREATEROLE. Rollback-only rehearsals alone cannot establish
compatibility with Neon's commit-time control-plane validation.
