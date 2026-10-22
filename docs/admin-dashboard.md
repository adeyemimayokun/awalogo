# Expanded admin workspace

The `/admin` workspace uses the existing GitHub maintainer allowlist. Overview,
Assets, Requests & reports, Updates, Analytics, Plugin and Notifications are available.
Financial logos retain their existing editor. The unified Assets view includes company
artwork, historical versions, flags, per-artwork formats, provenance and distribution.
Countries describe origin, headquarters and operating markets separately; unknown
values are explicit. Filters use AND across fields and OR within a field and persist
in the URL. The deployed catalog is a snapshot, not the contents of an open PR.

## Setup and release

1. Apply `supabase/admin-dashboard.sql` to a separate staging database first. All
   tables and RPCs are service-role-only; no browser database credentials are added.
2. Configure `ADMIN_ANALYTICS_VERCEL_TOKEN`, `ADMIN_ANALYTICS_PROJECT_ID`, and, for
   team projects, `ADMIN_ANALYTICS_TEAM_ID` on the server. Analytics access uses
   Vercel's documented `/v1/query/web-analytics/visits/aggregate` API and the existing
   plan's reporting window. No paid upgrade is performed.
3. Point `GITHUB_DEFAULT_BRANCH` to `staging` on Preview when reviewing this update.
   Keep Production's branch configuration unchanged until release approval.
4. Build and test the website and plugin. Review a sample source-change PR, run
   `pnpm brands:publish` then `pnpm brands:check`, and verify generated files match.
5. Deploy staging with product collection disabled. After a separate production
   release decision, enable both `VITE_ENABLE_PRODUCT_ANALYTICS` and
   `ENABLE_PRODUCT_ANALYTICS` in Production and rebuild. Pageview tracking still
   uses the independent `VITE_ENABLE_VERCEL_ANALYTICS` flag.

Traffic requests are authenticated, cached on the server for five minutes, and
never expose credentials. Missing configuration, provider failures, stale cached
results, empty datasets and retention/access restrictions appear explicitly.
Dates use UTC; visitors are provider-reported unique visitors over the selected
period. CSV exports contain aggregate traffic and product data, not contact fields.

## Maintenance

Company metadata, artwork replacement, verification, archival and removal prepare
source records and affected generated catalogs/artwork in a review PR. Historical
artwork retains its original source classification; raster versions remain raster
and are never enlarged or traced to SVG.
Financial entries use the original mutation pipeline and protected seed entries.
Flags metadata overrides are reviewed separately; flag artwork updates continue to
use the pinned `flag-icons@7.6.0` importer and preserve the upstream MIT license.
V2 editorial content lives in `v2-editorial.json`, separate from V1. Summary text
supports `{companyCount}` and `{flagCount}` placeholders; drafts are not displayed.
An open CMS PR is pending review, not a claim of successful publication. Confirm a
successful deployment and inspect its catalog before treating a change as live.

Reports are stored privately before best-effort email delivery when the database
is configured. Triage decisions and resolution notes are recorded atomically with
an audit entry. Resolved/dismissed reports require a note. Intake retries use the
submission UUID; request tracking and existing notifications retain their workflows.

Plugin counts are manually recorded from the published Community listing with
observation time and maintainer identity. Snapshots are append-only through the
admin API; observations older than seven days are marked stale. This measures the
published count, not active plugin users. No plugin telemetry or manifest change
is introduced.

## Product metric definitions

Events cover panel opens, prepared individual/ZIP downloads, successful bag actions,
code copying, debounced search result buckets, filter use, accepted requests and
accepted reports. Successful ZIP preparation records one ZIP event and one download
event per packed artwork. These are prepared downloads, not confirmed disk saves.
Legacy company-demand popularity is shown separately and is not backfilled.

The strict payload accepts only event names, known resource IDs, actual formats,
and fixed categorical details. It rejects arbitrary text and extra fields. Raw
searches, email, URLs, cookies, and persistent visitor IDs are excluded. Production
origin/build checks, private-route exclusions, DNT and GPC apply on the client;
server production/origin/opt-out checks also apply. Analytics never blocks actions.
Random event UUIDs deduplicate transport retries for two days; daily aggregates
persist. Per-instance throttling keeps only short-lived HMAC network keys in memory.
Counts remain best-effort and may be reduced by blockers or opt-outs.

References: https://vercel.com/docs/analytics/web-analytics-api and
https://supabase.com/docs/guides/api/securing-your-api.

## Staging connection configuration (2026-10-22)

Staging targets the restored `awalogo` Supabase project `cyfhxmhhtvsvfhzmcoot` and
Vercel project `prj_aezirDa30OOE8RDvaQStO0gV8eYm`, team
`team_GIV0KiNgMp69CfNynTFBOojq`. Preview variables are scoped to `staging`;
production values are not changed. Local non-secret settings are stored in ignored
`.env.development.local`.

Server credentials must be supplied securely by the owner:

- Supabase: open https://supabase.com/dashboard/project/cyfhxmhhtvsvfhzmcoot/settings/api
  and copy/create a secret API key. Save it as `SUPABASE_SECRET_KEY` in Vercel,
  Preview environment, Git branch `staging`.
- Vercel: create a team-scoped access token at https://vercel.com/account/settings/tokens.
  Save it as `ADMIN_ANALYTICS_VERCEL_TOKEN` with the same staging scope.
- Enable Web Analytics in https://vercel.com/ship-with-ai/nigerian-bank-logos/analytics
  on the free plan. The API currently reports that Web Analytics is not configured.
  Enabling reporting does not activate this website's production build tracking flags.
- After saving credentials, a new staging deployment is required for Vercel to load
  them. For local verification, place the server keys in `.env.development.local`
  (never a `VITE_` variable), then restart the local development server.

Both product analytics flags remain false in staging. Production activation is a
separate release action. Do not copy production service keys into staging.

The selected staging database was restored successfully and the admin dashboard,
request permissions, and legacy popularity SQL were applied on 2026-10-22.
Verified all eight relevant tables have RLS enabled, no `anon`/`authenticated`
SELECT grants, and server-role access. All three write RPCs deny public execution.
A service-role deduplication check succeeded inside a rolled-back transaction.
Security advisors reported only the expected informational notices for RLS tables
with no public policies; this is intentional for service-role-only storage.
