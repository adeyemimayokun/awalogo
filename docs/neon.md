# Neon PostgreSQL

The Vercel API uses server-only `pg` connections with Vercel's pool lifecycle
helper. Static catalogs, artwork, ZIP downloads, and GitHub admin authentication
remain unchanged. No Neon Auth, Functions, Storage, or Data API is required.

## Local Setup

The ignored `.neon` link targets project `square-forest-97336917`, branch
`production`, organization `org-damp-lake-20604727`. On a new checkout:

```sh
neon init -y --org-id org-damp-lake-20604727 --project-id square-forest-97336917 --branch production --services postgres
neon deploy
npm run db:migrate
npm run dev:web
```

After deploying the reviewed commit to the stable staging alias, run
`npm run db:smoke:staging`. This explicitly uses `.env.neon-staging.local`,
checks deployed request/report persistence and private tracking, verifies admin
authentication, compares V1 catalog records and sample asset checksums, and
removes its synthetic records. It never creates production data.

With a loopback dev server running and outbound email disabled, run
`npm run db:smoke -- http://127.0.0.1:5180`. This creates synthetic requests,
reports, snapshots, and counters, checks their HTTP/API/database round trips,
and cleans up its database rows. Use an isolated development branch for repeat
testing. Do not run it while a build is regenerating watched catalog files,
because Vite restarts when those files change.

In this pnpm monorepo, if init reports `ERR_PNPM_ADDING_TO_ROOT`, install its
dependencies with `pnpm add -w @neon/config @neon/env` and retry `neon deploy`.

`neon deploy` pulls `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (migrations),
and `NEON_BRANCH` into `.env.local` (or an existing `.env`). Never commit these
files, expose them with a `VITE_` prefix, or put connection strings in logs.
Set server-only `DOWNLOAD_HASH_SECRET` to a stable random secret of at least 32
bytes for daily anonymous download deduplication. Keep it stable across instances.

Apply the checked-in migrations using the direct connection. The runner uses
a transaction, an advisory lock, and checksums; reruns skip applied migrations.
Existing tables and records are not deleted. Do not edit applied migrations.
Test future migrations on a disposable Neon branch before applying them here.

## Provider Selection And Rollout

When `DATABASE_URL` exists, requests, tracking, reports, plugin snapshots,
download totals, and product-event storage use Neon. If it is absent, existing
Supabase environment variables continue to work. A Neon failure does not fall
back to Supabase, avoiding split writes. Keep database credentials server-only;
the HTTP API retains its existing authorization and same-origin checks.

Vercel staging uses a dedicated Neon `staging` branch, not `production`.
`DATABASE_URL`, `DOWNLOAD_HASH_SECRET`, and `DISABLE_PREVIEW_DELIVERY=true` are
scoped to Vercel Preview / Git branch `staging`. The guard saves requests and
reports to Neon but suppresses outbound email and GitHub issue mirroring in
Preview only. It cannot suppress production delivery. Product analytics and
launch guards are unchanged. Production uses the separate Neon `production`
branch; Vercel hosting, catalogs, and artwork remain unchanged.

Production's source is Supabase project `btrehjfxhqfwfpxrdyhl`, provisioned by
Vercel as `supabase-byzantium-umbrella`. The previous staging database is the
different Supabase project `cyfhxmhhtvsvfhzmcoot`. Never use the staging snapshot
as proof that production is empty. Keep old projects and credentials intact for
rollback; keep `DATABASE_URL_UNPOOLED` local or in migration CI.

## Production Cutover

The approved cutover on 2026-10-30 deployed application commit `8bf6c37` as
`dpl_5oCn2k746SfoTgrbZARw5dsR2iHB` on `awalogo.com` and `www.awalogo.com`.
The source contained one completed verification request and no brand ownership,
auth user, or stored-object records. That request was preserved exactly; the
post-cutover source and target counts/digests matched. The source had no report,
plugin-metric, or download/event tables, so Neon's checked-in schema now provides
them. The former production deployment `dpl_CWh3Y4QEMP8UTYMGmVvoLs949UXa` and
Supabase project remain intact for a controlled rollback. Staging keeps its
separate Preview deployment and database.

Capture a fresh read-only production snapshot, inspect all application tables,
and verify auth/storage usage separately. Use Vercel's existing Supabase SSO
if the ordinary Supabase connection cannot access this Vercel-managed project.
Keep snapshots under ignored `.vercel/` with mode 600, never in Git or logs.

```sh
neon env pull --branch production --service postgres --file .env.neon-production.local
node --env-file=.env.neon-production.local scripts/neon-migrate.mjs
SOURCE_SUPABASE_PROJECT_ID=btrehjfxhqfwfpxrdyhl node --env-file=.env.neon-production.local scripts/neon-import.mjs .vercel/source-production-snapshot.json
```

Set `DATABASE_URL`, `DOWNLOAD_HASH_SECRET`, and `NEON_BRANCH=production` only
in Vercel Production. Do not copy Preview delivery-suppression settings or
change analytics/launch flags. Build the staging-tested application commit
using production variables with automatic custom-domain assignment disabled,
then run `npm run db:smoke:production -- https://<production-deployment>.vercel.app`.
Promote that tested production deployment, recheck the live domain, and take a
final source snapshot after in-flight requests have drained. Import/verify any
new source rows; review conflicts instead of overwriting newer Neon records.
Restore the dedicated staging alias to its Preview deployment if production
promotion moves the shared Git-branch alias.

The production smoke test reads live APIs and checks a private synthetic tracking
fixture. Other database function tests use a rolled-back transaction. It sends
no email/GitHub notifications and removes its own fixture. Keep the source
snapshot available locally for field-for-field historical record verification.

Rollback uses the recorded previous production deployment and its existing
Supabase variables. First preserve/reconcile any Neon writes made after cutover;
blindly switching back can hide new requests. Do not delete or disconnect the old
database as part of rollout.

## Data Copy

Take a consistent read-only JSON snapshot of the source application tables,
including exact row counts and capture time. Store it only under ignored
`.vercel/`, with file mode 600, because requests contain private contact details.
Never log or commit the snapshot. Include requests, reports and audit rows,
plugin snapshots, download totals/daily deduplication keys, and product event
totals/receipts. Inspect all source tables first; do not silently omit populated
tables outside that list. Auth and object-storage migration are not needed by
the current app. Existing artwork stays in the repository and on Vercel.

```sh
neon env pull --branch staging --service postgres --file .env.neon-staging.local
node --env-file=.env.neon-staging.local scripts/neon-migrate.mjs
node --env-file=.env.neon-staging.local scripts/neon-import.mjs .vercel/source-snapshot.json
```

The importer is additive, transactional, and idempotent. Conflicting rows cause
a rollback instead of overwriting records. Every source row must compare equal
in PostgreSQL after insertion, not just produce the same total count. Source
writes after capture are not automatically replicated; a later production cutover
requires its own write freeze/final sync and verification.

## Verification

```sh
npm run db:migrate
npm run typecheck
npm test
npm run build
npm run dev:web
```

The database adapter accepts only the application's known tables, columns,
procedures, and filter operations. All SQL values use bound parameters. Tables
use RLS and revoke PUBLIC access; the server connects as their owner. No browser
database credentials or anonymous table grants are introduced.
