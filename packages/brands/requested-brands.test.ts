import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "./catalog.json";
import baseline from "./research/requested-baseline.json";
import { logos, matchesBrandScope } from "../../apps/web/src/v2-brand-data";
import { filterBrands } from "../../apps/web/src/brand-filters";

describe("requested and market-led coverage", () => {
  it("preserves all 95 pre-existing expansion records", () => {
    expect(Object.keys(baseline.records)).toHaveLength(95);
    for (const [slug,hash] of Object.entries(baseline.records)) {
      const record=catalog.brands.find((item)=>item.slug===slug);
      expect(createHash("sha256").update(JSON.stringify(record)).digest("hex"),slug).toBe(hash);
    }
  });
  it("exposes reviewed assets through search and filters", () => {
    for (const [query,slug] of [["Aradel","aradel-holdings"],["Nairametrics","nairametrics"],["Career Buddy","careerbuddy"],["Unflux","the-unflux"],["Utiva","utiva"],["Andela","andela"],["TechCabal","techcabal"],["Arnergy","arnergy"],["OmniRetail","omniretail"]]) {
      expect(filterBrands(logos,[],query).some((item)=>item.slug===slug),query).toBe(true);
      const brand=catalog.brands.find((item)=>item.slug===slug)!;
      expect(matchesBrandScope(slug,brand.industry,"NG")).toBe(true);
      expect(brand.formats.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("preserves official-filing provenance and resolves Unflux's external sprite", () => {
    expect(catalog.brands.find((item)=>item.slug==="aradel-holdings")?.source_type).toBe("verified-pdf");
    const brand=catalog.brands.find((item)=>item.slug==="the-unflux")!;
    const svg=brand.formats.find((item)=>item.type==="svg")!;
    const bytes=readFileSync(`apps/web/public${svg.url}`,"utf8");
    expect(bytes).toContain("<path");
    expect(bytes).not.toMatch(/<use\b|(?:href|src)=/);
  });
  it("does not duplicate legacy MoMo or LemFi", () => {
    expect(logos.filter((item)=>item.slug==="momo-payment-service-bank")).toHaveLength(1);
    expect(logos.filter((item)=>item.slug==="lemfi")).toHaveLength(1);
    expect(catalog.brands.some((item)=>["momo-psb","lemfi"].includes(item.slug))).toBe(false);
  });
});
