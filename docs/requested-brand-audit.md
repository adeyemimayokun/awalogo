# Requested Brands and Market Discovery — 19 October 2026

## Findings

- MoMo already existed as `momo-payment-service-bank`. MTN-specific queries were
  absent from its aliases. V2 now reads separately sourced search metadata for
  “MTN MoMo”, “MoMo from MTN”, “MoMo PSB” and “MTN Mobile Money”. Mono is a different
  existing brand; neither original record nor artwork is changed.
- Andela was awaiting review with customer/testimonial images among candidates.
  The actual embedded header SVG was identified and approved instead.
- Aradel's site returned HTTP 403. Its current identity was extracted from page 1
  of a company-issued filing hosted by NGX. The original PDF is retained in
  `packages/brands/research/evidence/`, and provenance is `verified-pdf`, not a claim
  of website retrieval. The derived artwork is raster, not a traced vector.
- Nairametrics, CareerBuddy, Utiva and The Unflux had not been seeded. Utiva's
  unnamed header image escaped logo heuristics. Unflux's header referenced an
  external SVG sprite: a standalone copy was blank. The exact named symbol has
  been extracted with its original paths and opacity; partner logos are excluded.
- LemFi already existed in the legacy catalog, so a duplicate was not published.

## Additions

Nine reviewed additions: Aradel Holdings, Nairametrics, CareerBuddy, The Unflux,
Utiva, Andela, TechCabal, Arnergy and OmniRetail. Every addition has retained
source bytes, evidence and PNG/WebP previews; SVG is offered only where an actual
self-contained source SVG exists. Country of origin and headquarters are not
inferred from coverage or target-market assignments.

Current V2 total: 332 brands (228 unchanged legacy records + 104 additions).
`requested-baseline.json` preserves hashes of all 95 additions before this batch.
The existing 1,703-file legacy baseline remains authoritative and unchanged.

## Discovery Sources and Limits

NGX's [official equities list](https://doclib.ngxgroup.com/DownloadsContent/Daily%20Official%20List%20-%20Equities%20for%2031-12-2025.pdf)
and [company filings](https://doclib.ngxgroup.com/Financial_NewsDocs/47232_ARADEL_HOLDINGS_PLC-CORPORATE_ACTION_ANNOUNCEMENT___CORPORATE_ACTIONS_JUNE_2026.pdf)
identify issuer candidates. TechCabal's
[research reports](https://insights.techcabal.com/reports/) and
[2025 funding review](https://insights.techcabal.com/wp-content/uploads/insight/2026/03/Top-50-Funded-Startups-in-2025.pdf)
identify additional technology-company candidates. Neither source is treated as
permission to copy artwork or proof that every candidate is currently listed.
Official company sources are checked separately before approval.

Presco and Transcorp remain unresolved after official-site retrieval failures.
Techpoint Africa and uLesson still need usable reviewed sources. Jobberman's
discovered image was another company's mark and is deliberately not approved.
These are documented in the manifest, not silently presented as covered.

The Unflux identity was confirmed by the user. Its official About page identifies
African design education and links the facilitator's own profile. That profile
identifies the project and Lagos connection; no incorporation or headquarters
claim is made. Wider African operating markets are not guessed.

This batch does not deploy production, release a Figma Community plugin, replace
legacy artwork or promise complete NGX/startup coverage.
