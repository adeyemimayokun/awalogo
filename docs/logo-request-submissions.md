# Website logo requests and company submissions

The website request form is designed for contributors who do not have a GitHub
account. Official company representatives can submit current artwork through a
second form using the same private delivery flow.

## How it works

1. `POST /api/logo-requests` validates the submitted fields and rejects the
   hidden spam-trap field when it is filled.
2. An opted-in availability request is enrolled in a private Resend contact
   segment before the submission is acknowledged.
3. The private contributor email and request details are delivered to the
   maintainer inbox through [Resend](https://resend.com/docs/api-reference/emails/send-email).
4. The contributor receives a branded confirmation email with a plain-text
   fallback.
5. The server creates a public `logo-request` issue through the
   [GitHub Issues API](https://docs.github.com/en/rest/issues/issues).
6. The public issue excludes the contributor email. If public issue creation
   fails, the private maintainer email remains the source of truth.

`POST /api/company-logo-submissions` follows the same sequence for official
company artwork. Work email addresses never appear in generated public issues.

## Deployment setup

Add these variables to the Vercel project:

```env
RESEND_API_KEY=
RESEND_AUDIENCE_API_KEY=
LOGO_REQUEST_FROM_EMAIL=awalogo <requests@awalogo.com>
LOGO_REQUEST_INBOX=
PUBLIC_SITE_URL=https://awalogo.com
CRON_SECRET=
```

Verify `awalogo.com` in Resend before using the example sender. The inbox is the
private maintainer address that receives submissions. Resend uses the
contributor email as the reply address so maintainers can respond directly.

`RESEND_API_KEY` needs **Sending access**. `RESEND_AUDIENCE_API_KEY` needs
**Full access** because it creates contacts and segments; keep it server-only.
Generate `CRON_SECRET` with `openssl rand -hex 32`. Vercel sends this value as a
bearer token to the daily cron route.

The existing `GITHUB_ADMIN_TOKEN` also needs **Issues: read and write**
permission for `adeyemimayokun/awalogo`. Issue creation is secondary and does
not block a successful private submission.

## Privacy

- Contributor emails are required but never added to public issue content.
- Logo links, institution details, categories, and the availability-notification
  preference may be published in the generated issue.
- When notification is requested, the private address is held in Resend until
  the daily catalog check finds an exact live name, slug, or alias match.
- The address is removed from the pending segment after successful delivery.
  Ambiguous matches require a maintainer decision in `/admin`.
- API errors are logged without logging the submitted form payload.

See [email-templates.md](./email-templates.md) for the complete template set and
the logo-publication notification workflow.
