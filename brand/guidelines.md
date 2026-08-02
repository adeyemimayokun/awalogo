# awalogo brand guidelines

Version 1.0 · August 2026

## 1. Brand foundation

### Name

The brand is written **awalogo**, always lowercase. “Awa” is a familiar Nigerian
rendering of “our,” so the name communicates shared ownership: **our logo**.

Use `awalogo` in product UI, prose, filenames, package names, and social handles.
Use title case only when a platform automatically applies it. Never write
`Awa Logo`, `AwaLogo`, or `AWALOGO` as the primary brand name.

### Purpose

Make dependable Nigerian brand assets easier to find and use across design and
development workflows.

### Mission

Build an open, source-aware catalog of Nigerian institutional logos that helps
designers move faster, gives developers reusable assets, and gives contributors
a responsible way to improve coverage.

### Vision

Become the shared identity infrastructure for African digital products—starting
with Nigerian financial services, then expanding across industries and markets.

### Positioning

For designers and developers who need Nigerian institutional logos, awalogo is
an open-source, source-aware catalog that makes suitable assets easy to search,
download, copy, and insert. Unlike generic logo libraries, awalogo is built around
local coverage, provenance, format availability, and ongoing community review.

### Brand promise

**The right logo, ready for the work.**

### Core tagline

**Nigerian financial logos, ready to use.**

Channel variants:

- Figma: **Nigerian logos, ready for Figma.**
- Community: **Our logos. Built together.**
- Functional: **Search · Copy · Insert**

### Audiences

1. **Designers** need searchable assets that can be inserted into Figma without
   interrupting their workflow.
2. **Developers** need dependable formats and structured metadata without adding
   redundant files to applications.
3. **Institutions and contributors** need a clear way to submit current artwork,
   request corrections, and understand sourcing expectations.

### Personality

- **Precise:** source details, statuses, and formats are stated clearly.
- **Useful:** every element should help someone complete a real task.
- **Open:** contributions, corrections, and limitations are visible.
- **Local:** the brand is proudly Nigerian without relying on clichés.
- **Quietly confident:** strong structure and evidence replace exaggerated claims.

## 2. Logo system

### Core idea

The symbol combines lowercase **a** and **w** inside two interlocking tiles. The
tiles represent design and development working from a shared source of truth.
Their connector expresses exchange, contribution, and continuity across tools.

### Approved variants

| Variant | Use |
| --- | --- |
| Full-color symbol | Default mark on light, neutral, and dark controlled backgrounds |
| Flat symbol | Small sizes, print, embroidery, and low-complexity production |
| Horizontal lockup | Headers, partnership placements, documents, and campaign signatures |
| One-color Ink | Light backgrounds or single-color production |
| One-color Paper | Dark backgrounds or reversed single-color production |
| App icon | Figma, favicons, avatars, launcher tiles, and square containers |

Canonical files live in [`brand/logos`](./logos).

### Clear space

Define **x** as one quarter of the symbol’s tile height. Keep at least **x** clear
on every side of the symbol or lockup. Interface chrome may use half-x only when
the mark is 32 px or smaller and no other brand competes nearby.

### Minimum sizes

- Symbol: 24 px digital or 8 mm print.
- App icon: 32 px digital.
- Horizontal lockup: 120 px wide digital or 32 mm print.
- Campaign wordmark without the symbol: 90 px wide digital.

At smaller sizes, use the app icon or flat symbol. Do not use the gradient symbol
where its connector, letter counters, or tile edges become indistinct.

### Wordmark treatment

The wordmark is lowercase and bold. Use a single Paper or Ink color beside the
symbol. When the wordmark appears alone in a campaign, `awa` may be Lime while
`logo` remains Ink or Paper. Do not highlight `awa` when the full-color symbol is
already dominant in the same lockup.

### Placement

- Prefer top-left alignment in product and editorial layouts.
- Center the mark only in icons, splash screens, or intentionally quiet covers.
- Keep the mark away from crop-sensitive corners in social banners.
- On imagery, place the mark on a solid Ink or Paper holding shape rather than
  directly over a visually busy region.

### Never

- Stretch, rotate, skew, outline, or redraw the symbol.
- Separate the `a` and `w` tiles or alter their connector.
- Replace the letters with another typeface.
- Apply arbitrary colors, rainbow treatments, glow, bevel, or heavy shadows.
- Place Lime lettering on Paper; the contrast is insufficient for readable text.
- use the mark to imply endorsement by a cataloged institution.

## 3. Color system

### Core palette

| Token | Hex | RGB | Role |
| --- | --- | --- | --- |
| Ink 950 | `#111411` | 17, 20, 17 | Primary dark background and text |
| Surface 850 | `#242925` | 36, 41, 37 | Raised dark surfaces and logo gradient end |
| Lime 400 | `#D8EF55` | 216, 239, 85 | Primary signal, active state, and logo |
| Lime 500 | `#B8D93D` | 184, 217, 61 | Depth, hover, and approved logo gradient end |
| Paper 50 | `#F7F7F2` | 247, 247, 242 | Warm light background and reversed text |
| White | `#FFFFFF` | 255, 255, 255 | Utility surface where warmth is unnecessary |
| Muted 600 | `#686A64` | 104, 106, 100 | Secondary text on light backgrounds |
| Line 200 | `#E1E4DD` | 225, 228, 221 | Borders, dividers, and quiet grid lines |

### Usage ratio

Use approximately 60% Ink or Paper, 30% supporting surface tones, and no more
than 10% Lime. Lime is a signal: reserve it for the mark, active controls, status
dots, short rules, and small moments of emphasis.

### Accessibility

- Ink on Paper: 17.26:1.
- Ink on Lime: 14.49:1.
- Surface on Paper: 13.77:1.
- Muted on Paper: 5.10:1.
- Paper or White on Lime is not accessible for normal text; use Ink on Lime.
- The logo’s approved gradient may use `#D8EF55` to `#B8D93D`. Do not introduce
  decorative gradients elsewhere in the system.

Status colors may be added in product UI only when they communicate state. They
are not brand accents and should never compete with Lime.

## 4. Typography

awalogo uses portable system typography because the product is offline-first and
must remain consistent across the web, Figma, and developer environments.

### Sans stack

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Mono stack

```css
font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
```

Use the sans stack for all product, marketing, and documentation copy. Use the
mono stack only for package names, commands, source URLs, file formats, hashes,
and construction labels.

### Type scale

| Style | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| Campaign | 64 / 68 | 700 | Large-format launch work |
| Display | 48 / 52 | 700 | Website hero and covers |
| H1 | 36 / 42 | 700 | Page titles |
| H2 | 28 / 34 | 650–700 | Section titles |
| H3 | 20 / 28 | 600 | Cards and subsections |
| Body | 16 / 24 | 400 | Primary reading text |
| Small | 14 / 20 | 400 | Supporting content |
| Label | 12 / 16 | 600 | Categories, metadata, and controls |

Use sentence case. Avoid all caps except short functional labels such as `SVG`,
`PNG`, `OPEN SOURCE`, and `SOURCE-AWARE`. Keep line lengths between 45 and 75
characters for long-form reading.

## 5. Layout and graphic language

### Grid

- Base spacing unit: 4 px.
- Primary rhythm: 8 px.
- Common gaps: 8, 12, 16, 24, 32, 48, and 64 px.
- Marketing safe margin: at least 6% of the shortest canvas edge.
- Product maximum content width: 1280 px.

### Shapes

- Use rectangles, modular tiles, and interlocking notches derived from the logo.
- Interface radius: 6 px by default; 8 px for large cards; fully rounded only
  for status dots and compact pills.
- Borders are 1 px and quiet. Avoid thick outlines.
- Shadows should be rare, soft, and structural—not decorative.

### Signature devices

1. **Catalog grid:** fine low-contrast lines with occasional registration nodes.
2. **Logo tile:** abstract neutral placeholders representing catalog coverage.
3. **Lime signal:** a dot, short rule, active cell, or source-aware indicator.
4. **Interlock notch:** use sparingly as a crop or panel transition.
5. **Source label:** compact metadata in sans or mono type.

Never use real institution logos as decorative texture. When examples are
necessary, use only approved catalog artwork, name the context, and keep the
institution’s mark unaltered.

## 6. Iconography and illustration

- Use simple outline icons with rounded joins and 1.5–1.75 px strokes at 16–24 px.
- Prefer functional symbols: search, filter, download, copy, format, source,
  review, and contribution.
- Icons inherit Ink, Paper, or Muted. Lime indicates an active or successful state.
- Do not create a separate illustrative mascot.
- Brand illustration should be geometric and catalog-inspired: tiles, grids,
  metadata lines, format labels, and source paths.

## 7. Imagery

The primary brand world is interface- and system-led rather than photographic.

Use:

- Clean product crops and believable search/catalog surfaces.
- Abstract logo placeholders when presenting the system generically.
- Editorial close-ups of design and development workflows when photography adds
  context.
- Restrained grain, halftone, or registration marks at low opacity.

Avoid generic office stock imagery, cliché national symbols, unrelated fintech
visuals, glossy 3D objects, and AI-generated institution marks.

## 8. Motion

- Micro-interaction: 160 ms.
- Panel or drawer transition: 240 ms.
- Campaign reveal: 400–600 ms.
- Preferred easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Animate search, filtering, insertion, and tile transitions—not the logo itself.
- Respect `prefers-reduced-motion` and keep all meaning available without motion.

## 9. Voice and messaging

### Voice principles

- Lead with the task or outcome.
- Use plain language and specific nouns.
- Be transparent about source status and format availability.
- Sound Nigerian through relevance and perspective, not slang or stereotypes.
- Invite participation without making the community responsible for quality.

### Approved language

Use:

- “Source-aware assets from official brand and institution materials.”
- “Reviewed logo assets in available SVG, PNG, and WebP formats.”
- “Available formats vary by institution.”
- “Request a logo” and “Submit current artwork.”
- “Logo pending” when an institution is listed without approved artwork.

Avoid:

- “Every logo is verified.”
- “Copyright-free logos.”
- “Official partner of Nigerian banks.”
- “All logos are SVG.”
- Claims that the catalog is complete or permanently current.

### Copy library

**One-line description**

> An open-source catalog of Nigerian financial logos for design and development.

**Short description**

> Search reviewed logos from Nigerian banks, fintechs, insurers, payment
> providers, and regulators. Download or insert the formats available for each
> institution.

**Boilerplate**

> awalogo is an independent, open-source catalog of logos from Nigeria’s
> financial ecosystem. It helps designers and developers search, download, copy,
> and insert source-aware brand assets while maintaining provenance, review, and
> correction workflows. Logo artwork remains the property of its respective
> owners.

**Calls to action**

- Search logos
- Explore the catalog
- Insert in Figma
- Request a logo
- Submit current artwork
- Report a correction
- Contribute on GitHub

## 10. Channel guidance

### Website and product

Use Paper as the default reading surface and Ink for text. Use Lime for active
states and small signals. Keep catalog content visually neutral so institution
logos—not awalogo decoration—remain the focus.

### Figma Community

Use the app icon, the Figma-specific tagline, and visible product context. State
that the plugin is offline-first and that available formats vary.

### Social

Use one message per image. Prefer Ink backgrounds, a compact logo lockup, one
large headline, a small source-aware line, and generous negative space. Keep key
content away from edges and profile-image overlays.

### GitHub and documentation

Lead with purpose, installation, contribution, and trademark clarity. Use code
formatting for package names and commands. Do not use cataloged logos as page
decoration.

## 11. Trademark, licensing, and governance

- awalogo’s software and tooling follow the repository’s MIT license.
- Institution logos are trademarks of their respective owners and are not
  relicensed by awalogo.
- Inclusion does not imply endorsement, partnership, or affiliation.
- Preserve source metadata and status whenever a catalog asset is redistributed.
- Remove or update assets when provenance cannot be verified, artwork becomes
  outdated, or a rights holder requests action.
- The awalogo identity should be used to identify or promote the project, not to
  make unrelated products appear official.

See [`TRADEMARKS.md`](../TRADEMARKS.md) and
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

## 12. Asset production and naming

Use lowercase kebab-case filenames:

```text
awalogo-[asset]-[variant]-[width]x[height].[ext]
```

Examples:

```text
awalogo-symbol-full-color.svg
awalogo-app-icon-512x512.png
awalogo-linkedin-page-cover-4200x700.png
```

Before publishing an asset:

1. Confirm the correct logo variant and clear space.
2. Confirm exact channel dimensions and safe areas.
3. Check text spelling and live product claims.
4. Verify contrast and legibility at final display size.
5. Confirm that any institution artwork is approved and unaltered.
6. Export PNG for social, SVG for editable brand artwork, and WebP only where a
   consuming product requires it.
7. Add the asset to [`manifest.json`](./manifest.json).

## 13. Accessibility and alt text

Default logo alt text:

> awalogo interlocking a and w mark

Default campaign alt text:

> awalogo — Nigerian financial logos, ready to use

Decorative grids, register marks, and abstract logo tiles should be hidden from
assistive technology. Do not repeat visible adjacent copy in alt text unless the
image itself is the only place the message appears.

## 14. Asset index

- [`logos/`](./logos): primary artwork and approved variants.
- [`icons/`](./icons): channel-ready raster icons.
- [`patterns/`](./patterns): reusable catalog-grid device.
- [`social/`](./social): exported channel artwork.
- [`templates/`](./templates): editable recurring layouts.
- [`tokens/`](./tokens): implementation tokens.
- [`visuals/`](./visuals): presentation board.

For dimensions and recommended use, consult [`manifest.json`](./manifest.json).
