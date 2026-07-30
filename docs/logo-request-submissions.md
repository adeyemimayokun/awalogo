# Website logo requests

The website request form is designed for contributors who do not have a GitHub
account. Submitting the form sends the request directly to the awalogo
maintainers and shows a confirmation in the website.

## How it works

1. `POST /api/logo-requests` validates the submitted fields and rejects the
   hidden spam-trap field when it is filled.
2. The private contributor email and request details are delivered to the
   maintainer inbox through [Resend](https://resend.com/docs/api-reference/emails/send-email).
3. The server creates a public `logo-request` issue through the
   [GitHub Issues API](https://docs.github.com/en/rest/issues/issues).
4. The public issue excludes the contributor email. If public issue creation
   fails, the private maintainer email remains the source of truth.

## Deployment setup

Add these variables to the Vercel project:

```env
RESEND_API_KEY=
LOGO_REQUEST_FROM_EMAIL=awalogo <requests@awalogo.com>
LOGO_REQUEST_INBOX=
```

Verify `awalogo.com` in Resend before using the example sender. The inbox is the
private maintainer address that receives submissions. Resend uses the
contributor email as the reply address so maintainers can respond directly.

The existing `GITHUB_ADMIN_TOKEN` also needs **Issues: read and write**
permission for `adeyemimayokun/awalogo`. Issue creation is secondary and does
not block a successful private submission.

## Privacy

- Contributor emails are required but never added to public issue content.
- Logo links, institution details, categories, and the availability-notification
  preference may be published in the generated issue.
- When notification is requested, maintainers use the private submission email
  to contact the contributor after the logo is published.
- API errors are logged without logging the submitted form payload.
