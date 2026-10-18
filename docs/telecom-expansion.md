# Telecom Expansion

## Scope

Grow V2 coverage of Nigerian and African mobile networks, fixed-line operators, broadband providers and network infrastructure brands. This is a reviewed expansion, not a claim that every licensed operator in every African country is already included. Nigeria alone has multiple licence categories; a licence holder is not automatically an active consumer brand.

The initial telecom research queue is in `packages/brands/research/telecom-candidates.json`, alongside the telecoms already in the original campaign. Official websites are research candidates, not endorsements or proof of active status. Redirects, ownership changes and rebrands must be reviewed before publication.

## Review And Publication

1. Run `node scripts/brands-baseline.mjs` and preserve the existing expansion records/assets against `telecom-baseline.json`.
2. Run `node scripts/research-brands.mjs` to stage new candidates, or use `--refresh --only=slug,...` for specific unresolved candidates. Do not refresh approved entries unnecessarily.
3. Inspect official website evidence, country of operation and staged artwork. Use `node scripts/review-brand-assets.mjs slug:assetIndex ...` to render a contact sheet on light and dark backgrounds.
4. Record approval or a hold in `reviews.json`. Do not infer a company's country of origin from its operating market. Unknown origin/headquarters remain null. Former names belong in aliases, not new duplicate logos. Community sources must remain labelled as such.
5. Publish batches of at most 25 using `node scripts/publish-brands.mjs`. All new assets use `/catalog/v2`; existing assets, V1 and the plugin remain unchanged.
6. Generate the tracked coverage report with `node scripts/telecom-coverage.mjs`. Pending and unresolved candidates stay private and do not appear as broken or placeholder logos.

## Source References

Snapshot reviewed on 18 October 2026: 89 telecom candidates tracked, 41 available
in V2, with pending/unresolved entries excluded from browsing. This is part of
84 independent V2 company additions, not an exhaustive census. See the
[Nigerian telecom audit](nigerian-telecom-audit.md) for current/historical gaps.
Historical 9mobile artwork is an explicitly community-sourced previous variation
under T2, discovered directly by spaced-name search; T2's primary remains intact.

- [NCC explanation of telecom licensees](https://consumer.ncc.gov.ng/articles/94-meet-the-licensees-who-provides-your-telecom-services).
- [T2mobile official company history](https://t2mobile.com.ng/about-us): formerly 9mobile. The older candidate URL was unreachable; the official Nigerian site is the preferred source.
- [AXIAN's Yas rebrand announcement](https://www.axian-telecom.com/2024/11/26/axian-telecom-unifie-les-marques-de-ses-operations-telcos-et-de-ses-operations-fintech/): avoid presenting the former Tigo, Free, Togocom or Telma identities as current Yas artwork.

Use `telecom-coverage.md` in the research directory for the actual available/pending/unresolved list. Regenerate it after each review batch. Continue country-by-country regulator checks to close coverage gaps; do not treat this seed list as an authoritative operator registry.
