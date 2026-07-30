# Admin CMS

The admin workspace is available at `/admin`. It uses GitHub OAuth for identity, checks the account against an explicit maintainer allowlist, and stores only a signed, short-lived HTTP-only session cookie in the browser.

Catalog changes never write directly to the default branch. Each upload or removal creates an isolated branch and pull request containing the metadata, source SVG, generated PNG/WebP assets, and format-manifest update.

The **Requests** dashboard uses public GitHub issues as its durable request
ledger. It reads both community logo requests and official company
submissions, then provides:

- Aggregate totals for new, active, published, and declined requests.
- Search plus request-type and status filters.
- A focused detail view for submitted websites, artwork, and brand guidelines.
- A six-state workflow: `New`, `In review`, `Sourcing asset`,
  `Ready to publish`, `Published`, and `Declined`.
- Auditable status labels in the form `request-status:STATUS`.

Moving a request to **Published** closes its issue as completed. Moving it to
**Declined** closes the issue as not planned. Returning either request to an
active state reopens the issue. The dashboard is intentionally contact-free:
requester email addresses remain in Resend and private maintainer email only.

The **Notifications** section shows pending request names and their catalog
match state without exposing requester addresses. Exact matches are sent by the
daily publication check. Maintainers can run the check immediately, resolve an
unmatched name to a live catalog entry, or use the one-off form for exceptional
cases.

## Deployment setup

1. Create a GitHub OAuth app. Set its callback URL to `https://YOUR_DOMAIN/api/auth/callback`.
2. Add the values from `.env.example` to the Vercel project environment.
3. Create a fine-grained GitHub token restricted to this repository with **Contents: read and write** and **Pull requests: read and write**.
4. Set `ADMIN_GITHUB_LOGINS` to the approved GitHub usernames, separated by commas.
5. Generate `ADMIN_SESSION_SECRET` with `openssl rand -base64 48`.
6. Add a full-access `RESEND_AUDIENCE_API_KEY` and generate `CRON_SECRET` with
   `openssl rand -hex 32`.

For local end-to-end testing, use `vercel dev` so both the Vite frontend and `/api` functions are available. The OAuth app needs a matching local callback URL.

## Security controls

- OAuth state verification and an eight-hour signed session.
- HTTP-only, same-site cookies; secure cookies in deployed environments.
- Server-side maintainer allowlist checks on every admin API request.
- Same-origin checks for mutations and logout.
- Request status mutations are limited to structured awalogo request issues;
  unrelated repository issues cannot be changed through the dashboard.
- Strict status schemas and repository labels preserve an auditable request
  history without exposing requester contact details.
- SVG payload size limits and rejection of scripts, event handlers, embedded HTML, JavaScript URLs, and remote resources.
- Server-only repository credentials and pull-request review before publication.
- Server-only notification contacts, secret-protected cron execution, and
  one-time queue cleanup after successful delivery.
- Typed confirmation for destructive actions.

New logos are created with `needs-review` status. A maintainer must verify the official source and change the status during pull-request review before the asset appears in the public catalog.
