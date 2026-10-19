# Popular Brand Coverage Audit — 19 October 2026

## Root Cause

Dangote Cement and Sugar were research candidates, not published brands. The old
`dangotecement.com` source failed retrieval and `dangotesugar.com.ng` failed DNS.
Their current official sites are `cement.dangote.com` and `sugar.dangote.com`.
Dangote Group, Refinery, Fertiliser and NASCON had never been seeded.
Official fallback pages are now recorded for future focused retries.

## Reviewed Additions

Seven additions: Dangote Group, Dangote Cement, Dangote Sugar, Dangote Refinery,
Dangote Fertiliser, NASCON Allied Industries and BUA Foods. Distinct official
artwork is used for each; white marks have dark previews. Source bytes, checksums
and review decisions are retained. Dangote Salt and Seasoning resolve to NASCON;
they are not separate invented company identities. NASCO is a different company.

The Dangote business directory supplies explicit corporate-affiliation evidence
for related-company suggestions. No inferred ownership links were added.

## Remaining Candidates

- BUA Group: official homepage retrieval failed; no reviewed addition.
- Flour Mills of Nigeria: official pages timed out; no reviewed addition.
- Dufil Prima Foods: client-rendered identity was not available through static
  artwork discovery; no reviewed addition. Do not substitute an Indomie product
  logo or redraw the wordmark.

These are documented gaps, not an exhaustive audit of every popular company.
Details and dispositions are in `packages/brands/research/manifest.json` and
`source-report.md`. The current V2 total is 323 brands: 228 original records and
95 additive records. The 88 expansion records present before this batch are
snapshotted in `popular-baseline.json`; regression tests assert identical hashes.
The existing 1,703-file legacy baseline is not replaced. No production deployment
or Figma Community plugin release is part of this batch.
