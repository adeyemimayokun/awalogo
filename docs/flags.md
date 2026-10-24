# Country Flags

V2 includes 249 ISO country/territory entries at `/v2/flags`, accessible through Flags in the top navigation and More > Country flags. Navigation stays in the same workspace. Search supports normalized country names and two-letter codes (including accents/punctuation); a region filter narrows results. V2 remains Coming soon.

Unfiltered lists show 20 items per page. The shared paginator shows the current
page, up to three previous and two next pages, and first/previous/next/last controls.
Search and region-filtered results are unpaginated; changes reset to page one.
Up to eight similar-name suggestions follow search results, respect the region
filter, and exclude direct matches. They do not imply visual or political relationships.
Empty results show a centered message with a primary reset action.

## Source and Artwork

- Source: https://github.com/lipis/flag-icons
- Pinned version: `flag-icons@7.6.0`, MIT artwork license retained at `/flags/v1/LICENSE.txt`.
- Official npm tarball SHA-512: `hir/PsXwr0EESyizKrXJzmkzpLIMf+1vlNKLqAfvdh+bsU94a7LYWTiubkHKqptGoCPzOUGcm6c4PfC9/BaGSQ==`.
- This is standardized 4:3 and square artwork, not original national proportions or an assertion of official status. Country and territory names follow the upstream dataset.
- Each variant offers original SVG plus generated PNG/WebP. Content-hashed static URLs prevent stale artwork and require no extra serverless functions or external image requests.

## Workflows

Flags support previews, individual downloads, raw SVG copying, HTML/React image snippets, share links, and the existing persistent 50-item/100MB download bag. Mixed logo/flag ZIPs contain source metadata and `FLAGS-LICENSE.txt`. Flag downloads do not inflate logo-popularity counts. Flags do not enter the existing logo-only runtime catalog or Figma plugin in this release.

The floating bag is shared with logos: Pack into bag, Drop item, Drop all, an
eight-second bulk undo, ZIP-time mutation locks, animations and saved position.
Compact controls, themes, languages and the persisted sound preference apply here.
Navigation search and `/` focus flag search rather than switching to logos;
`Alt+B` opens the collection. `Alt+R` still requests a logo, not a new flag entry.
Flag details do not use the logo-report endpoint or logo-only inline JSX mode.

## Regeneration

Download and verify the pinned npm archive, unpack it, then run:

```sh
node scripts/import-flags.mjs /path/to/unpacked/package
```

The importer validates the package version/license, country codes, namespaces, viewBoxes, and active/external SVG content before rasterizing. Commit generated metadata and assets together. Tests verify country uniqueness, variants, file signatures, standalone SVG namespaces, and every asset checksum.
