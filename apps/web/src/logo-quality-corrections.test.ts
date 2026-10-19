import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { logos as legacy } from "../../../packages/catalog-ui/src/logo-data";
import { correctionBySlug, logos } from "./v2-brand-data";
import expansion from "../../../packages/brands/catalog.json";
import baseline from "../../../packages/brands/research/quality-baseline.json";

describe("reviewed full-logo quality corrections", () => {
  const slugs = ["sparkle-microfinance-bank", "nomba", "ratefy", "connectpoint-technology-solutions"];
  it("overlays only artwork while preserving identity, categories and aliases", () => {
    for (const slug of slugs) {
      const before = legacy.find((brand) => brand.slug === slug)!;
      const after = logos.find((brand) => brand.slug === slug)!;
      expect(logos.filter((brand) => brand.slug === slug)).toHaveLength(1);
      expect(after.name).toBe(before.name);
      expect(after.aliases).toEqual(before.aliases);
      expect(after.category).toBe(before.category);
      expect(after.variations).toEqual(before.variations);
      expect(after.formats[0].checksum).not.toBe(before.formats[0].checksum);
      expect(correctionBySlug.get(slug)?.expected_primary_checksum).toBe(before.formats[0].checksum);
    }
  });
  it("does not rewrite any of the 153 existing expansion records", () => {
    expect(Object.keys(baseline.records)).toHaveLength(153);
    for (const [slug, checksum] of Object.entries(baseline.records)) {
      expect(createHash("sha256").update(JSON.stringify(expansion.brands.find((brand) => brand.slug === slug))).digest("hex"), slug).toBe(checksum);
    }
  });
  it("serves full wordmarks at native resolution with valid checksums and bag-format mappings", async () => {
    for (const slug of slugs) {
      const correction = correctionBySlug.get(slug)!;
      const source = await sharp(readFileSync(`packages/brands/${correction.source_path}`)).metadata();
      const brand = logos.find((item) => item.slug === slug)!;
      expect(brand.formats.map((asset) => asset.type)).toEqual(["png", "webp"]);
      for (const asset of brand.formats) {
        const bytes = readFileSync(`apps/web/public${asset.url}`);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.checksum);
        expect(asset.width!).toBeLessThanOrEqual(source.width!);
        expect(asset.height!).toBeLessThanOrEqual(source.height!);
        expect(asset.width! / asset.height!).toBeGreaterThan(2);
        expect(brand.asset_urls[asset.type]).toBe(asset.url);
      }
    }
    const sparkle = logos.find((brand) => brand.slug === "sparkle-microfinance-bank")!;
    expect(sparkle.formats[0].width).toBeGreaterThanOrEqual(550);
    expect(sparkle.formats[0].height).toBeLessThanOrEqual(159);
  });
});
