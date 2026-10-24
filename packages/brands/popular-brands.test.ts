import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import catalog from "./catalog.json";
import baseline from "./research/popular-baseline.json";
import affiliations from "./research/affiliations.json";
import { logos, matchesBrandScope } from "../../apps/web/src/v2-brand-data";
import { recommendBrands } from "../../apps/web/src/browse-tools";

describe("additive popular-brand coverage", () => {
  it("preserves all 88 pre-existing expansion records byte-for-byte", () => {
    expect(Object.keys(baseline.records)).toHaveLength(88);
    for (const [slug,hash] of Object.entries(baseline.records)) {
      const record=catalog.brands.find((item) => item.slug===slug);
      expect(record,slug).toBeDefined();
      expect(createHash("sha256").update(JSON.stringify(record)).digest("hex"),slug).toBe(hash);
    }
  });
  it("adds separately reviewed identities with usable formats and Nigeria filters", () => {
    for (const slug of ["dangote-group","dangote-cement","dangote-sugar","dangote-refinery","dangote-fertiliser","nascon-allied-industries","bua-foods"]) {
      const item=catalog.brands.find((item) => item.slug===slug)!;
      expect(item,slug).toBeDefined();
      expect(item.status).toBe("verified");
      expect(item.source_type).toBe("official-website");
      expect(item.formats.map((asset) => asset.type)).toEqual(expect.arrayContaining(["png","webp"]));
      expect(matchesBrandScope(slug,item.industry,"NG")).toBe(true);
    }
    expect(catalog.brands.find((item) => item.slug==="dangote-group")?.aliases).toContain("Dangote");
    expect(catalog.brands.find((item) => item.slug==="nascon-allied-industries")?.aliases).toContain("Dangote Salt");
  });
  it("uses sourced Dangote affiliations, without conflating NASCO and NASCON", () => {
    const group=logos.find((item) => item.slug==="dangote-group")!;
    const suggestions=recommendBrands(logos,[group],"Dangote Group",affiliations);
    expect(suggestions.find((item) => item.brand.slug==="nascon-allied-industries")?.related).toBe(true);
    expect(catalog.brands.some((item) => item.slug==="nasco")).toBe(false);
  });
});
