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
Preview only. It cannot suppress production delivery. Product analytics guards
and the production deployment/database remain unchanged.

Before a production cutover, copy and verify that production database separately.
The previous staging database is Supabase project `cyfhxmhhtvsvfhzmcoot`; do not
assume it is the same database as Vercel's production integration. Leave old
projects and credentials intact until the approved production migration is done.
Keep `DATABASE_URL_UNPOOLED` local or in migration CI.

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
