import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import catalog from "./catalog.json";
import baseline from "./research/hospitality-baseline.json";
import manifest from "./research/manifest.json";
import { logos, matchesBrandScope } from "../../apps/web/src/v2-brand-data";
import { filterBrands } from "../../apps/web/src/brand-filters";

describe("Nigerian retail and hospitality additions", () => {
  const batch = catalog.brands.filter((brand) => brand.batch === "nigerian-hospitality-2026-10-19");
  it("publishes eight individually reviewed identities with working formats and market filters", () => {
    expect(batch).toHaveLength(8);
    for (const brand of batch) {
      expect(logos.filter((item) => item.slug === brand.slug)).toHaveLength(1);
      expect(brand.source_type).toBe("official-website");
      expect(brand.status).toBe("verified");
      expect(brand.evidence.length).toBeGreaterThan(0);
      expect(matchesBrandScope(brand.slug, brand.industry, "NG")).toBe(true);
      expect(matchesBrandScope(brand.slug, brand.industry, "KE")).toBe(false);
      expect(brand.formats.map((asset) => asset.type)).toEqual(expect.arrayContaining(["png", "webp"]));
    }
  });
  it("finds familiar names without collapsing restaurants into their parent companies", () => {
    for (const [query, slug] of [["Ebeano", "prince-ebeano"], ["Justrite", "justrite-superstore"], ["Chicken Republic", "chicken-republic"], ["Kilimanjaro", "kilimanjaro-restaurants"], ["Club Quilox", "quilox"], ["Eko Hotel", "eko-hotels-and-suites"], ["Lagos Continental", "lagos-continental"]]) {
      expect(filterBrands(logos, [], query).some((brand) => brand.slug === slug), query).toBe(true);
    }
    expect(filterBrands(logos, ["hospitality-leisure"], "Quilox")).toHaveLength(1);
    expect(filterBrands(logos, ["financial-services"], "Quilox")).toHaveLength(0);
    expect(catalog.brands.find((brand) => brand.slug === "chicken-republic")?.formats[0].checksum)
      .not.toBe(catalog.brands.find((brand) => brand.slug === "food-concepts")?.formats[0].checksum);
  });
  it("does not publish unresolved candidates or change any existing expansion records", () => {
    for (const slug of ["market-square", "foodco", "transcorp-hotels"]) {
      expect(manifest.entries.find((entry) => entry.slug === slug)?.disposition).toBe("unresolved");
      expect(batch.some((brand) => brand.slug === slug)).toBe(false);
    }
    expect(Object.keys(baseline.records)).toHaveLength(116);
    for (const [slug, checksum] of Object.entries(baseline.records)) {
      const record = catalog.brands.find((brand) => brand.slug === slug);
      expect(createHash("sha256").update(JSON.stringify(record)).digest("hex"), slug).toBe(checksum);
    }
  });
});
