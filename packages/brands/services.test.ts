import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import catalog from "./catalog.json";
import baseline from "./research/services-baseline.json";
import candidates from "./research/services-candidates.json";
import { logos, matchesBrandScope } from "../../apps/web/src/v2-brand-data";
import { filterBrands } from "../../apps/web/src/brand-filters";

const requested = [
  ["Jendol supermarket", "jendol-superstores"], ["Renee Supermarket", "renee-supermarket"],
  ["Smile", "smile-communications"], ["Swift", "swift-networks"], ["Mobitel", "mobitel-nigeria"], ["Coollink", "coollink"],
  ["Cowry", "cowry"], ["Wakanow", "wakanow"], ["Lagride", "lagride"], ["Shuttlers", "shuttlers"], ["Chowdeck", "chowdeck"], ["Glovo", "glovo"],
  ["Dstv", "dstv"], ["Gotv", "gotv"], ["Startimes", "startimes"], ["StartimesON", "startimes-on"], ["Box Office", "boxoffice"],
  ["Iroko TV", "irokotv"], ["EbonyLife", "ebonylife"], ["KAVA", "kava"], ["NolliStream", "nollistream"], ["Showmax", "showmax"],
  ["NIBSS", "nibss"], ["InDrive", "indrive"], ["Bolt", "bolt"], ["Mano", "mano"], ["Gokada", "gokada"],
  ["GIGGO", "giggo"], ["Kwik", "kwik"], ["Sendbox", "sendbox"], ["FoodCourt", "foodcourt"]
];

describe("Requested supermarkets, connectivity, mobility, delivery and media", () => {
  const batch = catalog.brands.filter((brand) => brand.batch.startsWith("requested-services-"));
  it("covers all 31 requested names, reusing Swift and Coollink without duplicate records", () => {
    expect(candidates).toHaveLength(29);
    expect(batch).toHaveLength(29);
    for (const [query, slug] of requested) {
      expect(logos.filter((brand) => brand.slug === slug), query).toHaveLength(1);
      expect(filterBrands(logos, [], query).some((brand) => brand.slug === slug), query).toBe(true);
    }
    expect(batch.some((brand) => ["swift-networks", "coollink"].includes(brand.slug))).toBe(false);
    for (const id of new Set(batch.map((brand) => brand.batch))) {
      expect(batch.filter((brand) => brand.batch === id).length).toBeLessThanOrEqual(25);
    }
  });
  it("retains honest provenance, separate app identities and real raster formats", () => {
    const community = ["dstv", "gotv", "boxoffice", "irokotv", "ebonylife", "showmax"];
    for (const brand of batch) {
      expect(brand.status).toBe(community.includes(brand.slug) ? "needs-review" : "verified");
      expect(brand.source_type).toBe(community.includes(brand.slug) ? "community-catalog" : "official-website");
      expect(brand.evidence.length).toBeGreaterThan(0);
      expect(brand.formats.map((asset) => asset.type)).toEqual(expect.arrayContaining(["png", "webp"]));
      expect(matchesBrandScope(brand.slug, brand.industry, "NG")).toBe(true);
    }
    for (const slug of ["foodcourt", "boxoffice", "giggo", "renee-supermarket"]) {
      expect(batch.find((brand) => brand.slug === slug)?.formats.some((asset) => asset.type === "svg")).toBe(false);
    }
    expect(batch.find((brand) => brand.slug === "startimes")?.formats[0].checksum)
      .not.toBe(batch.find((brand) => brand.slug === "startimes-on")?.formats[0].checksum);
    expect(batch.find((brand) => brand.slug === "showmax")?.review_notes).toContain("discontinuation");
    expect(filterBrands(logos, ["transport-logistics"], "Cowry").map((brand) => brand.slug)).toEqual(["cowry"]);
  });
  it("preserves all 124 pre-existing expansion records byte-for-byte", () => {
    expect(Object.keys(baseline.records)).toHaveLength(124);
    for (const [slug, checksum] of Object.entries(baseline.records)) {
      const record = catalog.brands.find((brand) => brand.slug === slug);
      expect(createHash("sha256").update(JSON.stringify(record)).digest("hex"), slug).toBe(checksum);
    }
  });
});
