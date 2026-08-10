import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@awalogo/core": resolve(root, "packages/logos/src/index.ts"),
      "@awalogo/institutions": resolve(root, "packages/institutions/src/index.ts"),
      "@awalogo/catalog-ui": resolve(root, "packages/catalog-ui/src")
    }
  }
});
