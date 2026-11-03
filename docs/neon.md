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
use RLS and revoke PUBLIC access; provision the separate runtime role below instead
of using their migration owner for server traffic. No browser
database credentials or anonymous table grants are introduced.

## SEC-07 Runtime Role

The existing migration owner remains the owner of all tables/functions and uses
`DATABASE_URL_UNPOOLED`. Never replace that credential with the runtime credential,
grant owner membership to runtime, or expose either credential to the browser.
The runtime login is `awalogo_runtime`: NOSUPERUSER, NOBYPASSRLS, NOCREATEDB,
NOCREATEROLE, NOREPLICATION, NOINHERIT, no memberships and no object ownership.
Provisioning creates a NEW role only; existing roles cause a rollback, not password
rotation or permission changes. Use a disposable branch to rehearse first.

Offline review (does not load env files, connect, generate secrets or write files):

```sh
node scripts/neon-runtime-role.mjs --plan
node scripts/neon-runtime-role.mjs --dry-run
node --test scripts/neon-runtime-role.checks.mjs
```

Only after separate approval for the selected database, run migrations as the
existing owner, then explicitly provision using that same direct owner credential:

```sh
node --env-file=.env.neon-staging.local scripts/neon-migrate.mjs
node --env-file=.env.neon-staging.local scripts/neon-runtime-role.mjs --apply --output=.env.neon-staging-runtime.local
```

These commands are operator instructions, not automatic rollout. No remote or
production provisioning was performed for SEC-07. `--apply` uses ONLY the supplied
`DATABASE_URL_UNPOOLED`; it never implicitly loads `.env` or `.env.local`.
It requires migrations 001 and 002, takes the migration advisory lock, and changes
ACLs/policies in one transaction without deleting or rewriting application data.
It revokes PUBLIC database CREATE/TEMPORARY and public-schema CREATE because a
role-specific REVOKE cannot override PUBLIC access. Review this database-wide
effect for other logins first; the existing owner retains ownership privileges.

The generated 256-bit password is never accepted in arguments or printed. Neon
requires the original password in SQL over verified TLS and encrypts it at rest;
pre-hashed passwords are rejected by its control plane at commit. The provisioner
escapes the literal, enforces certificate verification, and never logs the SQL.
Standalone PostgreSQL rehearsals use a salted SCRAM verifier. See
[Neon's role documentation](https://neon.com/docs/manage/roles).
The only credential output
is an ignored runtime env file, exclusively created with mode 0600. The default is
`.env.neon-runtime.local`; `--apply --output=...` accepts only that exact basename,
`.env.neon-staging-runtime.local`, or `.env.neon-production-runtime.local` in the
current directory. Directory paths and owner env filenames are rejected. Use the
staging-specific output for staging testing and keep production output separate.
Existing
files/symlinks are refused. The file is synced before commit and removed on failure.
If a connection drops during COMMIT, the outcome may be uncertain: inspect the
role as owner before retrying; do not assume rollback or reuse a lost password.
Do not log query configuration, upload this file, or run the script with tracing.

The output contains server-only runtime `DATABASE_URL` (direct TLS connection).
For Neon pooled traffic, change only its endpoint hostname to the branch's verified
pooled hostname when installing the secret; retain runtime username/password and
TLS verification and `channel_binding=require` when present. Runtime URL generation
preserves `sslmode` and `channel_binding` but removes owner startup options.
Keep owner URLs local or in migration CI, not the API environment.
Keep staging and production credentials separate. Do not provision production or
change deployment variables without a separate reviewed rollout.

Grants and command-specific RLS policies are enumerated in the script. Requests
get SELECT/INSERT and status/timestamp UPDATE; reports add triage-field UPDATE;
snapshots get SELECT/INSERT; report audit gets INSERT only. Event/download counters
get SELECT/INSERT and counter UPDATE; their deduplication tables get SELECT/INSERT/
DELETE for expiry cleanup. Abuse budgets/receipts get SELECT/INSERT/DELETE and only
count/reply UPDATE respectively, plus EXECUTE on `claim_logo_request`. The three
existing application procedures also get explicit EXECUTE. All remain SECURITY
INVOKER. No blanket grants, default grants, migration-table grants, sequence grants,
SECURITY DEFINER functions or ownership transfers are introduced.

Policies intentionally permit all rows for those operations to this trusted
server login only. This is not per-user tenant isolation: HTTP authorization,
tracking tokens and admin authentication remain required. A compromised server
credential can perform those granted operations, including quota updates.
Provisioning audits effective PUBLIC/inherited privileges and rejects unrelated
schema access, migration/unlisted relation access, DDL privileges, and unexpected
or SECURITY DEFINER application functions. It does not silently rewrite unrelated
schema ACLs to make a failed audit pass. Review and fix those ACLs separately.
PostgreSQL system catalogs/built-in functions remain normally accessible.

### Local Database Verification

The integration test is opt-in, rejects non-loopback hosts and database names not
starting with `sec07_test`, and never reads application database environment vars.
Use a fresh, empty local PostgreSQL database with a test superuser, supplied in
`SEC07_TEST_DATABASE_URL` through your local secret environment. It installs both
migrations (discovered and sorted from `neon/migrations/*.sql`, without assuming an
abuse migration filename) and synthetic private fixtures, provisions the role, SET ROLEs to runtime,
checks invoker event/download/triage/abuse operations, then rolls everything back.
It verifies denied table/schema/temp/role DDL, ALTER, TRUNCATE, request DELETE,
migration-table reads and cross-schema reads. It never targets Neon.

```sh
node --test scripts/neon-runtime-role.checks.mjs
```

Without `SEC07_TEST_DATABASE_URL`, offline tests run and the integration test is
explicitly skipped. A successful offline run is not proof of database integration.
After future migrations, extend the explicit contract and rehearse provisioning
on a fresh disposable branch; do not add blanket future-table grants.

### Rollback-Only Staging Rehearsal

After migration workers confirm their SQL is stable, explicitly run:

```sh
node scripts/neon-runtime-staging-verify.mjs --staging
```

This does not run `--apply` or write runtime credentials. It starts a child process
without inherited database/PG/Node configuration, parses ONLY
`.env.neon-staging.local`, requires `NEON_BRANCH=staging`, and uses its direct
`DATABASE_URL_UNPOOLED` with TLS verification (preserving channel binding).
No production env file is read. Unknown flags or missing `--staging` fail offline.

Inside one transaction it takes the migration lock, validates applied checksums,
discovers sorted pending SQL migrations without assuming filenames, creates the
pending abuse tables, runs provisioning with nested BEGIN suppressed, and SET LOCAL
ROLEs to runtime. It refuses an existing runtime role or existing abuse tables:
this rehearsal is for the pending-migration state, not an already-provisioned DB.
Neon's owner does not automatically have SET permission on a new role: the verifier
temporarily grants runtime membership to the existing owner with SET TRUE and
INHERIT FALSE, then repeats the runtime privilege audit. It never grants owner
membership to runtime, and this test-only membership is rolled back too.
It checks denied DDL/migration/private-schema access; request/report/snapshot,
event/download invoker operations; receipt idempotency, storage lease recovery,
stale-owner rejection, delivery replay with an unchanged marker (202/unconfirmed
only with matching stored request; missing request stays pending), and
per-recipient/network/global quotas. Migration hashes are rechecked before success
to reject SQL changes during verification. All writes use new
synthetic keys; temporary restrictive DELETE policies prevent existing event and
download cleanup routines from touching pre-existing rows. It sends no HTTP,
email, or GitHub requests.

The finally block unconditionally rolls back role, ACLs, policies, pending tables
and synthetic records, then checks their absence. Output contains only test counts,
safe stage names and SQLSTATE on database errors, never credentials/rows/SQL errors.
Cleanup failures retain precise safe stage labels (rollback, owner restoration,
role/table/schema absence, request absence, all synthetic records, session close),
without printing assertion values. Original test failures are preserved if cleanup
also fails. A session-level verifier lock is retained through absence checks, so
concurrent verifier runs fail closed rather than race the post-rollback assertions.
Failure is not silently bypassed; unexpected PUBLIC/extension function privileges
are genuine provisioning findings requiring review. A disconnected session also
causes PostgreSQL to roll back; rerun verification if rollback confirmation is lost.

Freshly reverified on staging on 2026-11-02 against the final receipt `SELECT ...
FOR UPDATE` race fix: 29 checks passed with one pending migration rehearsed,
including delivery replay and all quota limits. Migration hashes stayed
stable; rollback and subsequent absence checks passed for the runtime role, pending
abuse tables, private fixture schema, and every synthetic record category. No
production connection, committed provisioning, credential-file output, or deployment
was performed. Offline checks: 11 passed; the separate local PostgreSQL test skipped.
The lock-before-phase/reclaim ordering is statically asserted. A two-connection
lease-boundary race was NOT executed: the rollback-only fixture objects are
uncommitted and invisible to another connection. No committed disposable fixtures
were created to work around that constraint. The previously reported generic
post-rollback failure did not reproduce in this serialized, stage-labelled run.
