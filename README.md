# awalogo

**Nigerian and African brand resources.**

Open source logo tooling and reviewed artwork for designers and developers.
V1 and the Figma plugin cover Nigerian financial brands. The V2 preview expands
to Nigerian companies across industries, African companies, and country flags.

Website: <https://awalogo.com>

The public website and Figma plugin are separate applications. V1 and the current
plugin share `/catalog/v1`; V2 combines that catalog with independent additions.

## Status

V1 and the current plugin remain available. V2 is an isolated **Coming soon**
preview at `/v2`, not a production launch announcement. As of 18 October 2026:

| Collection | Available | Distribution |
| --- | --- | --- |
| Existing financial logos | 228 | V1, current plugin, V2 |
| Independent company additions | 84 | V2 only |
| Combined company logos | 312 | V2 only |
| Country/territory flags | 249 | V2 only, `/v2/flags` |

Counts describe this repository snapshot, not an exhaustive company/operator registry.
Official and reviewed community artwork retain distinct provenance. Flags use
MIT-licensed standardized 4:3/square artwork, not guaranteed national proportions.

Original verified seed examples:

| Name | Category | Source |
| --- | --- | --- |
| Moniepoint | Microfinance bank | <https://moniepoint.com/icon.svg> |
| OPay | Fintech | <https://gstatic.opayweb.com/website-ng/img/opay-logo.684aa98.svg> |
| Flutterwave | Fintech | <https://flutterwave.com/images/logo/full.svg> |

The V1 runtime catalog contains 228 available logos. Coverage expands through an
institution-driven sourcing queue. Raster sources are preserved and never traced
or redrawn into SVG.

## Repository Structure

```txt
apps/figma-plugin      Figma plugin UI and plugin controller
apps/web               Public catalog website and admin entry
packages/catalog-ui    Shared catalog components, search, and asset adapters
packages/logos         Typed catalog, official sources, generated formats, sourcing queue
packages/institutions  Institution data, regulator imports, and CSV/JSON exports
packages/brands        Independent V2 companies, provenance, and historical artwork
packages/validator     Catalog and SVG validation scripts
brand                  Brand guidelines, tokens, logo variants, and channel assets
docs                   Product, contribution, and release notes
```

The complete identity system and reusable asset pool are documented in
[`brand/README.md`](./brand/README.md).

## Local Setup

```bash
corepack enable
pnpm install
pnpm logos:formats
pnpm validate
pnpm test
pnpm build:web
pnpm build:plugin
```

Refresh institution registers into a review-only staging area and regenerate committed exports with:

```bash
pnpm institutions:refresh
pnpm institutions:generate
pnpm institutions:check
pnpm catalog:generate
```

The snapshot coverage and known regulator-source gaps are recorded in `packages/institutions/exports/source-report.json`. Institutions remain separate from the logo catalog until official artwork is reviewed.

Refresh logo candidates from institution websites with:

```bash
pnpm logos:source
```

The command only updates `packages/logos/sourcing/queue.json`; it never accepts
or replaces catalog artwork automatically.

Audit all financial entries in Nigeria Logos and import available community
review assets with:

```bash
pnpm logos:import:nigerialogos
```

This writes a provenance report to
`packages/logos/sourcing/nigerialogos-report.json` and files to
`packages/logos/sourcing/nigerialogos-candidates`. Nigeria Logos is a third-party
discovery source, so imports are labeled `community-catalog` and `needs-review`
until the artwork is confirmed on an institution-owned official source.

Refresh the maintained official consumer-finance app set with:

```bash
pnpm logos:import:finance-apps
pnpm logos:import:naicom
pnpm institutions:generate
pnpm logos:promote
```

Logo coverage across the institution master export is recorded in:

- `packages/institutions/exports/logo-coverage-report.json`
- `packages/institutions/exports/logo-coverage-unresolved.csv`

These reports distinguish linked assets from institutions that still require
an official website and verifiable artwork.

If Corepack cannot write to your user cache, install pnpm directly and rerun the
same commands.

## Figma Plugin Development

```bash
pnpm build:plugin
```

For the standalone website:

```bash
pnpm dev:web
pnpm build:web
```

Then import `apps/figma-plugin/manifest.json` in Figma:

1. Open Figma desktop.
2. Go to Plugins > Development > Import plugin from manifest.
3. Select `apps/figma-plugin/manifest.json`.

The plugin loads the versioned catalog from `https://www.awalogo.com/catalog/v1/catalog.json`
and caches the last successful catalog plus recently used assets for offline fallback.
Its network access is restricted to the `www.awalogo.com/catalog/` path.

V1 and the current plugin expose the same generated set of available logos. V2
additions and flags are not included in the current plugin. Assets
support their available download formats, and official SVGs also support editable
insertion. Pending records are retained in the repository research data but are
excluded from both public products.

## V2 Preview

- Logos and flags have 20-item default pages, three previous/two next page links,
  and first/last jumps. Searches and filtered lists remain unpaginated.
- Logos support multi-category, industry and market filtering, popularity/name/newest
  sorting, former-name search, and sourced affiliation/name recommendations.
- Flags support region filtering, normalized name/code search and name suggestions.
- A draggable floating download bag supports Pack into bag, Drop item, Drop all,
  an 8-second bulk-drop undo, and mixed-resource ZIPs (50 items/100 MB).
- Asset panels provide available versions/formats, image code, SVG copying,
  sharing and logo reporting. Historical 9mobile artwork is a previous T2 version.
- Light/dark mode, English/Hausa/Yoruba/Igbo/Pidgin, contextual search shortcuts,
  compact controls and a persisted sound toggle are V2-only. Sounds are enabled
  after interaction by default, never on page load; translations remain drafts.

See the [V2 user guide](docs/v2-guide.md), [implemented behavior](docs/v2-browse-improvements.md),
[flags](docs/flags.md), [languages](docs/v2-languages.md), and
[delivery plan](docs/v2-product-and-delivery-plan.md). Public web help is at `/docs#v2`.

Production visit tracking uses Vercel Web Analytics with private-route exclusions,
URL query/fragment redaction and preview/local/opt-out protection. It requires an
explicit production flag and release; staging remains excluded. See
[analytics setup and verification](docs/analytics.md). This is not logo download
counting and does not enable tracking inside the Figma plugin.

## Adding Logos

For **new V2 companies**, use the separate [company expansion workflow](packages/brands/README.md).
Do not rewrite existing logo assets or force non-financial companies into institution records.
The workflow below applies to the original financial catalog:

Every logo needs:

- An official SVG or raster source in `packages/logos/src/sources` or `packages/logos/src/assets`.
- A catalog entry in `packages/logos/src/catalog.ts`.
- An official source URL owned by the institution or present in an official PDF.
- Generated PNG and WebP files created with `pnpm logos:formats`.
- A passing `pnpm validate` run.

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [TRADEMARKS.md](./TRADEMARKS.md).

Approved maintainers can also use the secured `/admin` workspace to upload
logos, add variations, and prepare removals as reviewable pull requests. See
[docs/admin-cms.md](./docs/admin-cms.md) for OAuth, repository-token, and
deployment configuration.

Website visitors can request a missing logo without a GitHub account. The
server privately delivers their contact email to maintainers and creates a
public tracking issue without exposing it. See
[docs/logo-request-submissions.md](./docs/logo-request-submissions.md) for
Resend and deployment configuration.

## License

Code and tooling are MIT licensed.

Logo assets are trademarks of their respective owners and are not relicensed as
MIT. See [TRADEMARKS.md](./TRADEMARKS.md).

Imported flag artwork has its own upstream MIT license, included with flag ZIPs.
