# awalogo Figma Plugin

Nigerian Bank Logos.

This workspace contains the runtime-synced Figma plugin UI and its sandboxed controller.

## Structure

```text
manifest.json        Figma plugin manifest
src/App.tsx          Standalone Figma plugin React entry
src/main.ts          Figma controller and vector insertion
src/messages.ts      Shared UI/controller message contract
src/figma-bridge.ts  Browser-safe Figma messaging adapter
vite.config.ts       Plugin browser-preview configuration
vite.plugin.config.ts  Self-contained plugin UI bundle
vite.main.config.ts  Controller IIFE bundle
```

## Build and import

From the repository root:

```bash
pnpm build:plugin
```

In the Figma desktop app, open **Plugins > Development > Import plugin from manifest** and select `apps/figma-plugin/manifest.json`.

The generated plugin files are `figma-dist/index.html` and `figma-dist/main.js`.

## Development

Use `pnpm dev:plugin` for the compact plugin browser preview. Insertion only works inside Figma.
The public website is developed separately with `pnpm dev:web` from `apps/web`.

For packaged plugin changes, run these in separate terminals:

```bash
pnpm --filter @awalogo/figma-plugin watch:ui
pnpm --filter @awalogo/figma-plugin watch:controller
```

Figma reloads the generated files; run the development plugin again after a rebuild. The UI build inlines its JavaScript and CSS into `figma-dist/index.html`. Logo payloads remain outside the bundle and are loaded only when needed.

## Runtime boundary

The plugin restricts network access to `www.awalogo.com/catalog/`. It loads the same
versioned catalog used by V1, validates asset checksums, and keeps a
bounded cache in `figma.clientStorage` for offline fallback. No CMS credentials,
analytics, or website admin code execute inside Figma.
## V2 Compatibility Note

### Interface Compatibility

All plugin views use the V2 neutral light/dark palette, system typography,
12px control radius, light border-based field focus, and compact desktop controls
with 44px coarse-pointer targets. Browsing uses spaced preview tiles; details,
collection, request, contribution, changelog, and trademark information use a
consistent right-side panel. Loading, errors, empty states, and the footer share
the same tokens. `src/v2-style.css` is the isolated visual layer; V1 styles and
Figma insertion logic are not modified by this styling update.

Native selects share an inset chevron and reserved arrow padding across sorting
and forms. Theme options support arrow keys, Home/End and Escape; the theme icon
reflects the resolved light/dark appearance even in System mode. Modal panels
contain keyboard focus, make background controls inert, and restore opener focus
when closed. Switching between modal views refreshes the active focus boundary.

The plugin now shares V2's compact rounded controls, primary Request logo action,
light focus indicators, quick light/dark toggle (with the existing System theme
menu retained), reset filters, and name/recent sorting. The searchable category
picker applies multi-select filters immediately and keeps its scroll area bounded.
`/` focuses search and `Alt+R` opens requests outside text entry; Escape dismisses
the active picker or panel. Asset details end with a Report logo link that prepares
a GitHub issue for user review, including the exact asset/version identifier.

Insertion, dimensions/aspect lock, copy, variations/history, project panels,
load-more browsing, refresh, and checksum-validated offline caching are retained.
SVG previews use the actual vector asset and sizing uses catalog dimensions.
Individual downloads are available next to insertion and copy.

### Resource Supplement And Collection

The new build combines the unchanged 228-logo `/catalog/v1` catalog with the
separate `/catalog/plugin/v2/index.json` supplement: 84 reviewed companies and
249 flags. Companies are not represented as financial-institution records.
Flags include rectangular and square variants and their MIT artwork attribution.
Historical artwork retains its separate identity and source link; it is not
presented as officially verified based on the current logo's status.

`node scripts/generate-plugin-resources.mjs` renders approved expansion assets,
verifies checksums, and creates the supplement and its content-addressed assets
under `apps/web/public/catalog/plugin/v2/`. The web build and plugin dev command
run this generator. These generated files are not committed. The manifest's
catalog-only network permission and existing controller messages are unchanged;
the controller additionally accepts the exact supplement asset path. Additive
`pack-load`/`pack-save` messages persist collection metadata in Figma clientStorage;
the existing insertion and asset message contracts remain supported.

Pack into bag saves the selected asset version and format. The persistent bag
holds up to 50 items, supports individual downloads, Drop item, Drop all with an
8-second Undo, and Insert all for mixed logo/flag collections (100 MB total limit).
Insert all creates an editable group centered on the canvas, fitting assets into
200-by-140 cells with 56 px gaps while preserving proportions. It never replaces
or clips existing selections. Individual downloads remain available. Preparation
loads every asset before insertion; a controller failure removes the new nodes.
Later mutations dismiss Undo; mutations are locked during bulk insertion.
`Alt+B` toggles the bag outside text entry. Saved metadata never embeds artwork;
downloads still pass through checksum validation.

If the supplement cannot load, the original catalog remains usable and a Retry
action is available. Valid cached supplement metadata is used when available;
asset offline fallback remains bounded by the controller cache budget.

This is a local development build, not a Figma Community publication. Production
must serve the generated supplement before the packaged plugin can load the new
resources in Figma. The current published plugin and V1 are unchanged. The new
controller build still needs an in-Figma insertion/replacement/clipping smoke test
before release. Website language and sound preferences are not imported into the
plugin; its existing theme and project panels remain independent.
