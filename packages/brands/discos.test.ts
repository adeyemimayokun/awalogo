import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import catalog from "./catalog.json";
import baseline from "./research/disco-baseline.json";
import candidates from "./research/disco-candidates.json";
import { logos, matchesBrandScope } from "../../apps/web/src/v2-brand-data";
import { filterBrands } from "../../apps/web/src/brand-filters";

describe("Nigerian regional DisCos and Aba Power", () => {
  it("publishes all eleven regional identities and Aba Power without duplicates", () => {
    expect(candidates).toHaveLength(12);
    const batch=catalog.brands.filter((item)=>item.batch==="nigerian-discos-2026-10-19");
    expect(batch).toHaveLength(12);
    for(const [name] of candidates) {
      const brand=batch.find((item)=>item.name===name)!;
      expect(brand,name).toBeDefined();
      expect(logos.filter((item)=>item.slug===brand.slug)).toHaveLength(1);
      expect(brand.source_type).toBe("official-website");
      expect(brand.status).toBe("verified");
      expect(matchesBrandScope(brand.slug,"energy-utilities","NG")).toBe(true);
      expect(brand.formats.map((item)=>item.type)).toEqual(expect.arrayContaining(["png","webp"]));
    }
    expect(batch.find((item)=>item.slug==="kaduna-electric")?.formats.some((item)=>item.type==="svg")).toBe(false);
  });
  it("supports unique operator acronyms and a shared DisCos search without alias collisions", () => {
    for(const [query,slug]of[["AEDC","abuja-electricity-distribution-company"],["BEDC","benin-electricity-distribution-company"],["EKEDC","eko-electricity-distribution-company"],["EEDC","enugu-electricity-distribution-company"],["IBEDC","ibadan-electricity-distribution-company"],["IKEDC","ikeja-electric"],["JEDC","jos-electricity-distribution-company"],["KAEDCO","kaduna-electric"],["KEDCO","kano-electricity-distribution-company"],["PHED","port-harcourt-electricity-distribution-company"],["YEDC","yola-electricity-distribution-company"],["APLE","aba-power"]]) {
      expect(filterBrands(logos,[],query).some((item)=>item.slug===slug),query).toBe(true);
    }
    expect(filterBrands(logos,[],"DisCos")).toHaveLength(12);
    expect(filterBrands(logos,["energy-utilities"],"electricity distribution")).toHaveLength(12);
    expect(filterBrands(logos,["fintech"],"DisCos")).toHaveLength(0);
  });
  it("preserves all 104 pre-existing expansion records", () => {
    expect(Object.keys(baseline.records)).toHaveLength(104);
    for(const [slug,checksum]of Object.entries(baseline.records)) {
      const record=catalog.brands.find((item)=>item.slug===slug);
      expect(createHash("sha256").update(JSON.stringify(record)).digest("hex"),slug).toBe(checksum);
    }
  });
});
