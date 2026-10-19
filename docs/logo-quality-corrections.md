# V2 Logo Quality Corrections

Reviewed 2026-10-19. No V1 asset, catalog record, existing expansion record or plugin publication is changed.

## Cause

Sparkle's official navigation embeds a 603x159 PNG of its full symbol-and-name lockup. The discovery helper ignored data URI images, leaving a 160x159 footer mark as the selected source. The legacy format generator enlarged that small source to 1024x1018, adding pixels but no detail. Changing CSS or relabeling it SVG would not recover the missing artwork.

Other sources selected favicons or icon-only artwork despite better header identities. The local audit checks all 381 brands for icon-source URLs and raster enlargement. Its 104 flags are review candidates, not 104 proven defects: icon-only branding can be intentional, and older publication sizes are preserved for compatibility. Five flagged entries have reviewed V2 overlays, including the earlier MoMo correction.

## Reviewed Corrections

| Brand | Before | V2 source |
|---|---|---|
| Sparkle | Enlarged footer mark | Original embedded full-logo PNG, 603x159 |
| Nomba | Favicon | Official name-and-symbol header artwork, 240x56 |
| Ratefy | Icon-only raster | Official full wordmark WebP, 1536x600 |
| ConnectPoint | Favicon | Official full header lockup, 500x149 |

Premium Pension was checked, but its current company site still uses the same favicon in its header. It remains unchanged pending a usable, independently reviewed full logo. Do not invent a wordmark or replace it with partner artwork.

All approved replacements retain original source bytes, checksums, source URLs, review notes and explicit target checksums. Corrections are V2 overlays and keep identity, category, aliases, historical variants and legacy files intact. PNG and WebP outputs do not exceed original raster dimensions. None is a fabricated SVG. Existing PNG/WebP bag selections resolve the new URLs through the same slug and format mappings.

## Prevention

- Discover named header images even when filenames are hashes or lack the word `logo`.
- Decode bounded PNG/JPEG/WebP base64 header candidates; exclude generic data placeholders and embedded SVGs. Candidates still require visual review before publication.
- Prefer the largest declared `srcset` candidate over a thumbnail.
- Prefer header identities over footer marks, with penalties for partner and app-store artwork; visual review still excludes programme art and unrelated logos.
- Never enlarge newly approved raster sources, even when a review omits the no-enlargement option. Exact historical source checksums in `raster-scale-compatibility.json` preserve old outputs without granting replacement or new artwork an enlargement exception. The legacy generator is intentionally unchanged.

`asset-quality-audit.json` records the remaining review queue; run `node scripts/audit-logo-quality.mjs --check` to verify it. Do not regenerate the compatibility snapshot for new assets. `quality-baseline.json` protects all 153 pre-existing expansion records. Regression tests cover discovery, rendering dimensions, checksums, preservation and format mappings.
