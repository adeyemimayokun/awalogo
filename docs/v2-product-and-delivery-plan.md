# awalogo V2 Product and Delivery Plan

Approved product direction: 14 October 2026.

Status reviewed: 18 October 2026. The architecture and owner workflows below are
target direction, not all delivered capabilities. See Current implementation status
and the [V2 guide](v2-guide.md) for the implemented preview.

## Product decisions

V2 targets Nigerian companies across industries and African companies, not an assertion of complete coverage. V1 and the current Figma plugin share `/catalog/v1`; additional V2 companies and flags are web-only until a separate plugin compatibility release. Visitors browse, download, request assets, and use a local download bag without an account. Accounts are required for the planned brand-management workflow.

The interface follows the restrained gallery direction of Icon Museum, Basicons, and Zona Logo, using an original neutral awalogo identity. V1 remains at its current URL throughout development. V2 is available at `/v2` and labeled Coming soon until an explicit launch decision.

Initial implemented materials are logos and flags; colors and PDF guidelines remain planned. Flags cover countries and territories with country codes and standardized 4:3/square variants, not guaranteed official proportions. Logos support hosted HTML/React image snippets and safe inline SVG/JSX; flags support hosted snippets and raw SVG copying.

Brand representatives verify a company-domain email and receive admin approval for their claim. Approved owners publish directly. Administrators can suspend publishing, revoke ownership, and restore earlier revisions. Every publication has an immutable audit record.

## Architecture

Preserve the monorepo, existing asset validation/generation pipeline, and Figma controller caching. Isolate V2 styling and routing from V1. Add a canonical brand model that links existing financial institution records without forcing other industries into regulator-specific categories.

Use Supabase authentication, PostgreSQL, and private storage for ownership, requests, drafts, uploads, and audit records. All exposed tables require row-level security and explicit brand membership authorization. Use managed services only within free-tier limits. Verify quotas and inactivity policies before launch and document operating limits.

Public assets remain static Vercel output with content-hashed URLs. Publication freezes a validated revision, creates a durable synchronization job, writes the repository revision through a scoped GitHub App, and triggers deployment. A revision becomes live only after deployed catalog verification. A failed deployment leaves the previous public revision active and permits an idempotent retry.

Produce a versioned V2 catalog and retain the V1 catalog for existing plugin clients. Both represent the same financial logo revisions, formats, and verification states; V1 ignores unsupported new material types. Public catalogs contain no private contact or ownership evidence.

## Public experience

- Search by brand name, aliases, former names, and industry. Combine collection, industry, subcategory, asset type, and country filters. Keep regulator categories as institution metadata.
- Brand pages expose logo variations before historical versions, colors, guidelines, official source links, download controls, and share links.
- Store named HEX values with provenance and usage labels; derive RGB values. Official and extracted palettes remain distinguishable. Do not invent colors when no evidence exists.
- Hosted HTML/React image snippets work for every image format. Inline SVG copying uses validated sanitized XML and JSX conversion, with accessible labels and selected dimensions.
- Persist download selections locally. ZIP bundles support up to 50 selections and 100 MB, provide progress and source metadata, and preserve the cart after errors.
- Requests suggest existing matches before submission, accept optional artwork, persist before sending email, and return a private tracking link. Notification failures retry without losing or duplicating a request.
- Country and territory flags live under `/v2/flags` with main navigation access, a shared download bag, and code copying. Validate source licenses and clearly label standardized proportions before importing artwork.

## Brand and admin experience

- Owners manage drafts for their assigned brand only. Claim exceptions and ownership disputes require admin review; an email domain alone does not grant publishing rights.
- Require MFA for sensitive ownership and publishing actions. Confirm membership and suspension state server-side on every write.
- Upload SVG, PNG, WebP, and PDF into private staging. Inspect actual file content, dimensions, size, and active content before preview or promotion. Reject unsafe SVG references, scripts, embedded HTML, and archive uploads.
- Retain version history and publication audit records. Admin rollback creates a new revision pointing to previous material, preserving history.
- Use durable database records rather than email or GitHub issues as the request source of truth. GitHub remains the publication record and optional issue mirror.

## Security and discoverability

Implement request throttling, bot protection, CSRF protection, secure sessions, ownership policies, content security headers, and SSRF protection for remote sourcing. Keep service credentials server-side. Replace production personal-token publication with a repository-scoped GitHub App.

Prerender brand and curated collection pages from the deployed catalog. Add unique titles/descriptions, canonical links, breadcrumbs, social images, image metadata, sitemap, and robots rules. Keep the V2 preview and private routes out of search indexes until launch. Preserve old shared links. Seek backlinks through useful collections, official brand relationships, and design resource partnerships; claims never require a backlink.

## Delivery gates

1. Foundation: approved document, feature inventory, isolated V2 route/design system, secure data model, durable requests, and publication synchronization.
2. Core: modern browsing, taxonomy, detail pages, colors, both code modes, cart, requests, prerendered SEO, and adapted plugin browsing.
3. Brand portal: claim review, owner publishing, guidelines, MFA, audit history, suspension, and rollback; pilot before general access.
4. Flags and launch: validated countries/territories, shared workflows, compatibility testing, production smoke tests, and explicit launch approval.

Verify visitor and owner journeys, cross-brand access denial, duplicate submissions, failed notifications, interrupted uploads, concurrent edits, publication retries, suspension, and rollback. Check ZIP integrity, SVG/JSX safety, website/plugin parity, old plugin compatibility, keyboard/mobile accessibility, and direct URL rendering.

Launch requires no critical security findings, documented capacity and backups, successful production flow tests, and no regression in V1. Post-launch V1 routing and the homepage cutover require a separate explicit launch decision.

## Current implementation status

The V2 Coming soon preview combines 228 unchanged financial logos with 84 independent additions (312 companies), plus 249 flags. New company records retain industry, origin/headquarters where known, reviewed markets and source provenance. Historical 9mobile artwork is exposed as a non-official community-sourced previous T2 version, with normalized spaced-name discovery. Telecom coverage remains incomplete and tracked separately.

Implemented browsing includes actual category labels, multiple categories, industry/market filters, popularity/name/newest sorting, and normalized search. Default logo and flag lists use 20-item pages, up to three previous/two next numbered links and first/last jumps. Filtered/search results are unpaginated. Similar-brand results use sourced affiliation/name matching; flags use name matching and region filters. Empty states are centered, with primary logo-request or flag-reset actions.

Asset side panels provide available versions/formats, preview/download, hosted code, logo inline SVG/JSX, SVG copying, sharing and logo reports. Requests suggest existing brands and display private tracking links when configured. Reporting stays at the bottom of the logo panel and does not apply to flags.

The floating bag is draggable, keyboard-movable and locally persistent, with asset-flight animations, a semantic count badge and an anchored collection. Pack into bag, Drop item and Drop all support mixed ZIPs, 50-item/100MB limits, preparation locks and an eight-second bulk undo invalidated by later mutations. Existing source/checksum checks remain.

The preview has one-click theme switching, five languages (English, Hausa, Yoruba, Igbo and Pidgin), compact controls, light field focus borders, contextual search/bag/request shortcuts, and persisted Action sounds enabled after interaction unless muted. Translation drafts await fluent review. See the [behavior notes](v2-browse-improvements.md) and [guide](v2-guide.md).

The supplied Supabase project `cyfhxmhhtvsvfhzmcoot` has the initial foundation schema. Vercel's Supabase integration separately provisioned `btrehjfxhqfwfpxrdyhl`; this integration-managed project is the active Production and Preview database. The same schema is applied there, with no existing data overwritten. Server-side request persistence, tracking, and admin status updates use the integration-provided `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Keep each URL paired with its own project's key. Local development should use a separate database or explicitly opt into the active project through ignored environment files. Live transaction tests verified own-brand access, cross-brand denial, private request denial, and suspended-brand write denial in the initial project and rolled back all test records.

Brand colors, PDF guidelines, prerendered brand pages, adapted plugin UI, claim-management screens, owner upload staging and publication automation remain implementation work. The implemented taxonomy is the independent V2 industry/country model, not a completed owner platform. Database configuration notes above record earlier setup, not a fresh production verification. Live browser/audio/mobile and production smoke tests, translation review and explicit launch approval remain gates; automated tests/builds do not establish production readiness.

## References

- https://icon.museum/
- https://www.basicons.com/
- https://zonalogo.com/
- https://developers.google.com/search/docs/appearance/google-images
- https://github.com/lipis/flag-icons
