# Country Flags

V2 includes 249 ISO country/territory entries at `/v2/flags`, accessible through the Logos/Flags collection switch and More > Country flags. Navigation stays in the same workspace. Search supports country names and two-letter codes; a region filter narrows results.

## Source and Artwork

- Source: https://github.com/lipis/flag-icons
- Pinned version: `flag-icons@7.6.0`, MIT artwork license retained at `/flags/v1/LICENSE.txt`.
- Official npm tarball SHA-512: `hir/PsXwr0EESyizKrXJzmkzpLIMf+1vlNKLqAfvdh+bsU94a7LYWTiubkHKqptGoCPzOUGcm6c4PfC9/BaGSQ==`.
- This is standardized 4:3 and square artwork, not original national proportions or an assertion of official status. Country and territory names follow the upstream dataset.
- Each variant offers original SVG plus generated PNG/WebP. Content-hashed static URLs prevent stale artwork and require no extra serverless functions or external image requests.

## Workflows

Flags support previews, individual downloads, raw SVG copying, HTML/React image snippets, share links, and the existing persistent 50-item/100MB download bag. Mixed logo/flag ZIPs contain source metadata and `FLAGS-LICENSE.txt`. Flag downloads do not inflate logo-popularity counts. Flags do not enter the existing logo-only runtime catalog or Figma plugin in this release.

## Regeneration

Download and verify the pinned npm archive, unpack it, then run:

```sh
node scripts/import-flags.mjs /path/to/unpacked/package
```

The importer validates the package version/license, country codes, namespaces, viewBoxes, and active/external SVG content before rasterizing. Commit generated metadata and assets together. Tests verify country uniqueness, variants, file signatures, standalone SVG namespaces, and every asset checksum.
