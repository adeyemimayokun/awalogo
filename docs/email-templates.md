# Transactional email templates

awalogo uses one email-safe visual system for visitor and maintainer messages:

- System UI typography.
- A white 600 px content canvas on a soft neutral page.
- Light borders, `#737373` supporting text, and `#c9e45d` actions.
- Table-based layout and inline styles for broad email-client support.
- A hidden preheader and plain-text fallback for every message.
- The hosted awalogo brand mark, with no tracking pixels.

Templates live in `api/_lib/email-templates.ts`.

## Template inventory

| Template | Recipient | Trigger |
| --- | --- | --- |
| Logo request received | Requester | A missing-logo request is accepted |
| New logo request | Maintainer inbox | A missing-logo request is accepted |
| Logo now live | Requester | The catalog check finds an opted-in request, or a maintainer resolves it |
| Company submission received | Company representative | Official artwork is accepted for review |
| New company submission | Maintainer inbox | Official artwork is accepted for review |

The logo-now-live template also covers an approved company submission. It is a
one-time transactional message, not a mailing-list subscription.

## Publication notification flow

1. A requester selects **Notify me when this logo is available**.
2. The API adds the private address to a Resend segment derived from the
   normalized institution name.
3. A daily Vercel cron compares pending segment keys with live catalog names,
   slugs, and aliases.
4. One exact match sends the logo-now-live email automatically.
5. Successful recipients are removed from the pending segment. A completed
   segment is deleted, making the notification one-time.
6. Ambiguous or unmatched requests stay pending in `/admin` until a maintainer
   maps them to the correct live catalog entry.

The automatic endpoint is `GET /api/cron/logo-notifications` and requires the
`CRON_SECRET` bearer token supplied by Vercel. The queue endpoint is
`GET/POST /api/admin/logo-notifications`; it requires the normal maintainer
session and same-origin protection for dispatches.

`POST /api/admin/notify-logo-live` remains available in the admin workspace for
exceptional one-off messages. Deterministic Resend idempotency keys reduce
duplicate sends.

## Delivery behavior

- Maintainer delivery is required before a public submission is accepted.
- Public GitHub issue creation is best effort and never contains contributor
  email addresses.
- Visitor confirmation delivery is required after the private submission is
  safely delivered. Resend idempotency keys protect retries from duplicate
  messages.
- Notification contacts are stored privately in Resend and are not returned to
  the admin browser. Only normalized request names and match states are shown.
- Resend uses `LOGO_REQUEST_INBOX` as the reply address for visitor messages.
- Configure and verify the sender with the variables documented in
  [logo-request-submissions.md](./logo-request-submissions.md).
