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
versioned catalog used by the website, validates asset checksums, and keeps a
bounded cache in `figma.clientStorage` for offline fallback. No CMS credentials,
analytics, or website admin code execute inside Figma.
