# MoMo Asset Correction — 19 October 2026

The user explicitly requested the MoMo identity from https://www.momo.ng/.
The existing legacy file depicts **MoMo Agent**, not the current MoMo Payment
Service Bank identity. The official Nigerian homepage's `logo-yellow-1.png`
was visually reviewed; the site's MTN-only footer mark was rejected as a
substitute for MoMo.

The correction is a separate V2 overlay, not a new company or a rewrite of V1.
The slug, name, category and aliases remain intact. V2 previews, downloads, code
snippets and bag format resolution all read the corrected PNG/WebP formats.
Existing shared links still resolve to the same slug. White/yellow details are
displayed on a dark preview background. No vector is invented from raster art.

`packages/brands/research/asset-corrections.json` records explicit approval, source
checksum and the expected old primary checksum. `publish-brand-corrections.mjs`
fails on changed targets, duplicate corrections or source checksum mismatch.
Builds generate content-hashed assets and a separate `asset-corrections.json`
projection; they require no network access. Check mode verifies identical output.

The legacy catalog, `/catalog/v1`, original source assets and current published
Figma plugin are unchanged. This correction has not been deployed to production.
