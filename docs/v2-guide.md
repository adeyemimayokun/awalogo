# V2 Preview Guide

Repository snapshot: 18 October 2026. V2 remains **Coming soon** at `/v2`.
Implemented locally does not mean deployed, launched, or production-verified.

## Collections And Discovery

The preview combines 228 unchanged financial logos with 84 independent additions
for 312 company entries. `/v2/flags` contains 249 countries/territories. Counts may
grow; historical versions do not count as extra companies. V1 and the current
Figma plugin still use `/catalog/v1` and do not include V2 additions or flags.

- Search logos by name, aliases, or former name. Spaces, punctuation and accents
  are normalized. Searching `9mobile`, `9 mobile`, or `9-mobile` shows historical
  9mobile artwork and opens that version under T2, not a replacement T2 identity.
- Combine multiple categories with industry and African operating-market filters.
  Detail/card labels show the available actual category rather than a generic bucket.
- Logos default to Most popular: editorial company prominence plus measured download
  demand when configured. Name and Newest added are alternatives. See [popularity](popularity.md).
- Flag search supports names and two-letter codes; the region filter narrows it.
- Default, unfiltered lists show 20 items per page. Current page links include at
  most three previous and two next pages, with first/previous/next/last controls.
  Searches and filtered lists are unpaginated. Filter/sort changes reset the page.
- Similar brands appear separately after search, at most eight, within active filters.
  Verified corporate links rank before similar names; no inferred ownership or industry peers.
  Similar flags use names only, never visual similarity or political relationships.
- Empty logo results offer a primary request action; empty flag results offer reset.
  Both states are centered. Request panels stay in the workspace.

## Assets And Collection

Open a logo or flag to preview the selected format/variant, download it, copy
HTML/React image code or available SVG, and share a link. Logos also support
validated inline SVG/JSX. Formats depend on source availability; raster artwork
is never traced to manufacture vectors. Flag variants are standardized 4:3 and square.
Image snippets use the current deployment origin so preview-only assets do not
incorrectly point at production. Use production-origin snippets in production projects.

Pack assets into the floating download bag. Drag it to move it; focused arrow keys
move it and Home restores its default position. The position and collection persist
locally when storage is available. New packs animate toward the bag, respecting
reduced motion. Opening the bag reveals the collection anchored to its icon.

Drop item removes one selection. Drop all empties the collection and offers Undo
for eight seconds. A later mutation dismisses that undo to avoid overwriting new
choices. Mutations are disabled during ZIP preparation. Limits remain 50 selections
and 100 MB; failed downloads retain the collection. A mixed ZIP includes source
metadata and the flag license when applicable. Flag downloads do not count toward
logo popularity.

## Preferences And Access

- Language: English default, Hausa, Yoruba, Igbo and Nigerian Pidgin. Translations
  are drafts awaiting fluent-speaker review. Editorial release notes remain English.
- Theme: one-click light/dark switch; first visit follows the system preference.
- Sound: enabled after interaction unless a mute preference was saved. More options
  contains Action sounds. Nothing plays on page load, typing, hovering or dragging.
  Unsupported/blocked audio never blocks an action.
- Controls: 36px desktop commands/fields, 40px search, at least 44px touch targets,
  matching field radii and light focus indicators. The desktop gallery keeps four columns.

| Shortcut | Action |
| --- | --- |
| `/` | Focus search in the current collection |
| `Alt+B` | Open/close the download bag |
| `Alt+R` | Open the logo request panel |
| `Escape` | Close the active menu/panel layer |

Global shortcuts ignore text entry, composition, repeats and conflicting modifiers.
Search does not steal focus from an open panel. Tooltips and accessibility attributes
expose relevant bindings; destructive actions have no global shortcut.

## Corrections And Provenance

Logo panels end with Found an issue? and Report logo, separated from other content.
Reports include the selected version/format and never automatically alter artwork.
They use the maintainer email path, not the request admin queue. Flags do not use
the logo-report endpoint. See [logo reports](logo-reports.md).

Official-source verification is not a trademark license. Community historical artwork
is explicitly non-official; 9mobile is a reviewed community-sourced previous version.
Unknown origin/headquarters are not inferred from markets. Pending candidates are
not shown as broken placeholders. Coverage is not a complete African telecom census.

## Verification And Remaining Work

Tests cover pagination, search/recommendations, keyboard routing, pack/drop/undo
state, flag artwork checksums and mixed-resource metadata, translations and catalog
isolation. Run the commands in the [contributor guide](../CONTRIBUTING.md).
Live browser/audio/mobile validation and deployment smoke tests remain release gates;
automated checks do not replace them. Existing bundle-size warnings remain.

Brand colors, PDF guidelines, owner claim/publishing screens, publication automation,
prerendered SEO and V2 plugin compatibility are not completed by this preview.
