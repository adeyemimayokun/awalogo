# Logo Reports

V2 logo details include a Report logo action. The form stays in the existing side panel and attaches the canonical logo slug, selected variation, and format. Cancel returns to the same asset without changing the user's search or selected format.

Found an issue? is the last section of the logo side panel, with space separating
it from source/code content. The handler accepts reviewed historical variations
under their parent company, including T2's `9mobile-previous`; it validates the
actual selected asset, not a replacement current identity. Flags do not use this
logo-only form or endpoint.

Reasons: Outdated logo, Wrong color, Wrong asset, Broken download, Other. Notes and an official-source URL are optional, except Other requires a description. Reports do not change or remove artwork automatically.

## Delivery

Reports POST to `/api/logo-requests?view=report`, reusing an existing Vercel function. Maintainer delivery uses the existing `RESEND_API_KEY`, `LOGO_REQUEST_FROM_EMAIL`, and `LOGO_REQUEST_INBOX` configuration and the shared branded email layout. No database migration or new serverless function is required. Provider idempotency keys protect retries. The client shows success only after delivery is accepted; failures retain form values.

Reports are delivered to the maintainer inbox, not the admin logo-request list. No visitor email address or account is required. No live report emails are sent by automated tests.

## Protection

The handler enforces same-origin writes, strict payload limits, catalog/variation/format validation, HTTP(S)-only source links, an empty honeypot, HTML escaping, and best-effort per-instance throttling of five valid attempts per network per hour. Network identifiers are HMAC-hashed in memory; raw addresses are not included in reports. This throttle is not a distributed abuse-control guarantee. `LOGO_REPORT_RATE_SECRET` is optional; otherwise each instance generates an ephemeral secret.

The visual references show a Cloudflare challenge, but no CAPTCHA widget is simulated. A real Turnstile integration would require site/secret keys and server-side token verification; platform firewall rate limiting or Turnstile should be configured if abuse increases.
