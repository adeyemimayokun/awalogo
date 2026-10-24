# Admin release checklist

## Staging release

The admin expansion is released to the `staging` branch first. Production deployment
and production analytics activation remain separate actions. Review the staging-to-main
pull request before promotion. Catalog edits continue to use their own reviewed PRs.

Validation on 2026-10-22: typecheck, 302 tests, logo/institution validation, runtime
catalog consistency, V2 brand checks, website/plugin builds, and the 12-function Vercel
limit passed. Theme/responsive checks previously passed at 1440, 768, 390, and 320px.

The selected staging Supabase project is `cyfhxmhhtvsvfhzmcoot`. Admin/report/product
and legacy-popularity tables were installed and permissions verified. Server-only
secrets for database and traffic reporting are saved in Vercel Preview/staging.
This does not by itself validate their values or enable collection.

## GitHub sign-in setup

Create a separate OAuth application at https://github.com/settings/applications/new.
Use the verified stable staging preview origin as Homepage URL and append
`/api/auth/callback` for Authorization callback URL. Save these settings only to
Vercel's Preview environment, Git branch `staging`:

- `GITHUB_OAUTH_CLIENT_ID`: the application's client ID.
- `GITHUB_OAUTH_CLIENT_SECRET`: a generated application secret.
- `ADMIN_SESSION_SECRET`: a new independent random value of at least 32 characters.
- `ADMIN_GITHUB_LOGINS`: `adeyemimayokun` (or another explicitly approved maintainer).
- `PUBLIC_SITE_URL`: the stable staging preview origin, without a trailing slash.

Store secrets as Sensitive variables. Never paste them into issues or chat. Creating
an allowlist entry grants persistent admin access. A new deployment is required
when settings change. Do not inherit Production OAuth credentials into staging.

## Verification after configuration

1. Sign in through GitHub and verify non-maintainers receive no admin access.
2. Check Overview/Analytics/Plugin and distinguish empty, unavailable, and disabled.
3. Prepare a reversible asset edit through its correct reviewed repository pipeline;
   verify a PR remains pending until merged and successfully deployed.
4. Resolve a test report with a note and check its audit record.
5. Record only a genuine observed plugin snapshot with Community source evidence.
6. Check date ranges, CSV export, notifications, keyboard access, and mobile themes.
7. Verify product event deduplication and opt-outs; staging must not collect events.

## Production gate and rollback

Before production, select a dedicated production database, apply the reviewed SQL,
configure production secrets, validate GitHub auth and traffic API access, and run
checks on the exact candidate commit. Production tracking flags require a separate
activation decision. No paid integrations are required or purchased.

Record the previous READY production deployment before promotion. On a regression,
roll back to that deployment through Vercel. Database migrations in this release are
additive; do not drop the audit, report, snapshot, or aggregate tables on rollback.

## Current acceptance status

The independent staging session secret and `adeyemimayokun` maintainer allowlist
were configured with the owner's explicit approval. The staging `PUBLIC_SITE_URL`
is `https://nigerian-bank-logos-git-staging-ship-with-ai.vercel.app`; use that as the
OAuth Homepage URL and append `/api/auth/callback` for its callback URL. The OAuth
client ID and secret still need to be supplied by the owner.

Preview attempts failed before build startup with `Resource provisioning failed`;
no build events were returned. The latest investigated failure was
`dpl_7wwB53KoXsLEyRcGsbGnxhzYbSo4`. The user sees no errored integration, while
integration inspection through the connected API returns 403. Provider/account-side
investigation is required before authenticated deployment checks can run.

The current ready production rollback baseline is
`dpl_CX1TvDV6iTX86kJ7tnSmvQXAyqFZ` at main commit
`dab8c9c1267d42dbf552ffa25f0b57c0dcad0526`. It has not been promoted or changed.
