import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@awalogo/core", replacement: resolve(root, "../../packages/logos/src/index.ts") },
      { find: "@awalogo/institutions", replacement: resolve(root, "../../packages/institutions/src/index.ts") },
      { find: "@awalogo/catalog-ui", replacement: resolve(root, "../../packages/catalog-ui/src") },
      { find: "@logo-assets", replacement: resolve(root, "../../packages/logos/src/assets") }
    ]
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
