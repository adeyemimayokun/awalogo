# awalogo V2 Product and Delivery Plan

Approved product direction: 14 October 2026.

## Product decisions

V2 expands awalogo to all Nigerian brands. The website and Figma plugin share published assets. Visitors browse, download, request assets, and use a local download cart without an account. Accounts are required for brand management.

The interface follows the restrained gallery direction of Icon Museum, Basicons, and Zona Logo, using an original neutral awalogo identity. V1 remains at its current URL throughout development. V2 is available at `/v2` and labeled Coming soon until an explicit launch decision.

Initial brand materials include logos, colors, and PDF guidelines. Flags cover countries and territories with country codes and original rectangular proportions. HTML and React copying support both hosted image snippets and safe inline SVG.

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
- Country and territory flags live under `/v2/flags` with main navigation access, shared download cart, and shared code copying. Validate source licenses and original proportions before importing artwork.

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

The initial public V2 preview uses the existing real catalog and provides search, category filtering, selected logo versions, individual downloads, hosted HTML/React snippets, validated inline SVG/JSX, sharing, and a persistent ZIP download bag. A V2 request page suggests existing brands and displays private tracking links when database storage is configured.

The supplied Supabase project `cyfhxmhhtvsvfhzmcoot` now has brand, membership, claim, draft, revision, publication job, audit, and private request tables with row-level security. Server-side request persistence, tracking, and admin status updates are wired behind `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Those credentials must be configured before the database flow can be tested end to end. Live transaction tests verified own-brand access, cross-brand denial, private request denial, and suspended-brand write denial, then rolled back all test records.

Brand colors, country flags, a new taxonomy, prerendered brand pages, adapted plugin UI, claim management screens, upload staging, and publication automation remain implementation work. Do not describe these flows as production ready before end-to-end verification.

## References

- https://icon.museum/
- https://www.basicons.com/
- https://zonalogo.com/
- https://developers.google.com/search/docs/appearance/google-images
- https://github.com/lipis/flag-icons
