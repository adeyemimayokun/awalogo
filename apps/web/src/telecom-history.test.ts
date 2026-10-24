import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { filterBrands } from "./brand-filters";
import { formerBrandName, searchedHistoricalVersion } from "./brand-history";
import { logos, matchesBrandScope, historicalArtworkFor } from "./v2-brand-data";
import history from "../../../packages/brands/historical-catalog.json";
import { historicalCatalogSchema } from "../../../packages/brands/historical-schema";

describe("Nigerian telecom history and discovery", () => {
  it("shows and opens the historical artwork when searching its name", () => {
    const brand = logos.find((item) => item.slug === "t2-mobile")!;
    for (const query of ["9mobile", "9 mobile", "9-mobile"]) expect(searchedHistoricalVersion(brand.variations, query)?.id).toBe("9mobile-previous");
    for (const query of ["", "T2", "mobile"]) expect(searchedHistoricalVersion(brand.variations, query)).toBeUndefined();
  });
  it("finds the same Nigerian operator under all 9mobile spellings", () => {
    const nigeria = logos.filter((brand) => matchesBrandScope(brand.slug, "telecommunications", "NG"));
    for (const query of ["9mobile", "9 mobile", "9-mobile", "T2mobile", "Etisalat Nigeria"]) expect(filterBrands(nigeria, [], query).map((brand) => brand.slug)).toContain("t2-mobile");
    expect(formerBrandName("t2-mobile")).toBe("9mobile");
  });
  it("preserves T2 as primary and exposes 9mobile as a historical community variation", () => {
    const brand = logos.find((item) => item.slug === "t2-mobile")!;
    const old = brand.variations.find((item) => item.id === "9mobile-previous")!;
    expect(old.status).toBe("old");
    expect(old.name).toBe("9mobile");
    expect(old.formats.map((asset) => asset.type)).toEqual(["svg", "png", "webp"]);
    expect(brand.formats[0].url).not.toBe(old.formats[0].url);
    expect(historicalArtworkFor(brand.slug, old.id)).toMatchObject({ source_type: "community-catalog", status: "needs-review" });
    expect(historicalCatalogSchema.safeParse({ variations: [{ ...history.variations[0], status: "verified" }] }).success).toBe(false);
  });
  it("validates every historical download's bytes and route", () => {
    for (const variation of historicalCatalogSchema.parse(history).variations) for (const asset of variation.formats) {
      const bytes = readFileSync(`apps/web/public${asset.url}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.checksum);
      expect(asset.url).toBe(`/catalog/v2/assets/${asset.checksum}.${asset.type}`);
    }
  });
  it("recovers providers blocked by earlier source gaps", () => {
    for (const slug of ["fiberone", "21st-century-technologies"]) expect(matchesBrandScope(slug, "telecommunications", "NG")).toBe(true);
    expect(filterBrands(logos, [], "Fibre One").some((brand) => brand.slug === "fiberone")).toBe(true);
  });
});
