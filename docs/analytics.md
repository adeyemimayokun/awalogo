# Website Visit Analytics

The website uses the installed `@vercel/analytics` React SDK for Vercel Web
Analytics. This is separate from [logo download popularity](popularity.md) and
optional Speed Insights performance measurements. The Figma plugin has no tracker.

## Collection Boundaries

- Tracking requires a production build, `VITE_ENABLE_VERCEL_ANALYTICS=true`, and an
  HTTPS production origin: `awalogo.com` or `www.awalogo.com`.
- Localhost, branch URLs, preview deployment URLs and unrelated hosts never mount
  Analytics, even when the enable flag is accidentally set.
- Admin, authentication, API and request/tracking routes are excluded. The SDK
  `beforeSend` guard also drops private-route events after client navigation.
- Pageview URLs have every query parameter and fragment removed before submission.
  Brand IDs, search query parameters and private tracking tokens are not retained
  in these pageview URLs. SDK-provided browser/referrer metadata remains subject to
  Vercel's documented processing; this is not a custom payload collector.
- Browser Do Not Track (`1`) and Global Privacy Control opt out at page load.
- No custom events, form field payloads, account IDs or session replay are added.
  Thus packing, dropping and opening a panel are not separate traffic events.

Vercel provides aggregate visitor, pageview, referrer, location and device reports.
Its Web Analytics is cookie-free; do not treat this as a guarantee of legal
compliance for every jurisdiction. Review your site's privacy disclosures before
activation. Ad blockers, opt-outs and filtering can reduce measured counts.

## Activation

1. Open the project's [Web Analytics dashboard](https://vercel.com/ship-with-ai/nigerian-bank-logos/analytics).
   The service is already enabled on this project; no paid upgrade was selected.
2. Review and release the analytics guard code to production. Do not promote the
   entire V2 staging branch merely to enable visit tracking; use an analytics-only
   release if V2 is not ready.
3. Set `VITE_ENABLE_VERCEL_ANALYTICS=true` for **Production only**, then deploy the
   reviewed release. Vite embeds this flag at build time; changing it does not
   activate existing deployments. Keep Preview/staging false.
4. Visit a public production page with a browser that has not opted out. Verify
   `/_vercel/insights/script.js` and the analytics collection request in browser
   network tools, then check the dashboard's Production filter for pageviews.
5. Confirm there are no analytics script loads on staging, localhost, admin or
   request routes, and test sanitized URLs with the automated suite.

Until the production flag and reviewed release are deployed, this is implemented
but does not establish live visitor collection. Do not claim historical data has
been backfilled. Basic pageviews do not require paid custom events or a new API.

## Operations

Set the production flag to false and redeploy to stop client pageview collection.
Disabling the service in Vercel is separate from changing the build-time flag.
Update the origin allowlist in `apps/web/src/site-analytics.ts` before adding a new
production hostname; do not include previews to simplify testing.

The SDK handles supported browser navigation without a separate manual pageview
listener. Do not add duplicate `track`/`pageview` calls. Current manual validation
on the live site waits for production release approval; simulated tests are not a
claim that real visitor events have reached Vercel.

References: [Vercel setup](https://vercel.com/docs/analytics/quickstart),
[event filtering](https://vercel.com/docs/analytics/package),
[privacy/data collection](https://vercel.com/docs/analytics/privacy-policy).
