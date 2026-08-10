import { afterEach, describe, expect, it, vi } from "vitest";
import generatedRuntimeCatalog from "./generated/runtime-catalog.json";
import { parseRuntimeCatalog } from "./runtime-catalog";

describe("public runtime catalog", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has deterministic unique entries and content-addressed assets", () => {
    const catalog = parseRuntimeCatalog(generatedRuntimeCatalog);
    const slugs = catalog.items.map((item) => item.logo.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const item of catalog.items) {
      for (const asset of [
        ...item.logo.formats,
        ...item.logo.variations.flatMap((variation) => variation.formats)
      ]) {
        expect(asset.url).toContain(asset.checksum);
        expect(asset.repository_path).toMatch(/^assets\//);
      }
    }
  });

  it("rejects incompatible versions and unsafe asset URLs", () => {
    expect(() => parseRuntimeCatalog({ ...generatedRuntimeCatalog, schema_version: 2 })).toThrow();
    const changed = structuredClone(generatedRuntimeCatalog);
    changed.items[0].logo.formats[0].url = "https://example.com/logo.svg";
    expect(() => parseRuntimeCatalog(changed)).toThrow();
  });

  it("validates metadata in the Figma controller sandbox without URL", () => {
    vi.stubGlobal("URL", undefined);
    const catalog = parseRuntimeCatalog(generatedRuntimeCatalog);
    expect(catalog.items).toHaveLength(228);
  });
});
