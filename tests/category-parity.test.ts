import { describe, expect, it } from "vitest";
import generated from "../packages/catalog-ui/src/generated/runtime-catalog.json";
import { parseRuntimeCatalog } from "@awalogo/catalog-ui/runtime-catalog";
import { logos as websiteLogos } from "../apps/web/src/v2-brand-data";
import { brandCategory } from "../apps/web/src/brand-category";
import { catalogItemsFromRuntime, catalogCategoryOptions, displayCategory, matchesCategory, type CatalogItem } from "../apps/figma-plugin/src/catalog-data";
import { searchScore } from "../apps/figma-plugin/src/catalog-search";

const legacy = catalogItemsFromRuntime(parseRuntimeCatalog(generated));
const legacySlugs = new Set(legacy.map((item) => item.logo.slug));
const items: CatalogItem[] = [...legacy, ...websiteLogos.filter((logo) => !legacySlugs.has(logo.slug)).map((logo) => ({ logo, displayName: logo.name, categories: [logo.category], institutions: [], kind: "company" as const }))];

describe("V2/plugin category parity", () => {
  it("uses exactly the same browse groups, counts and ordering as V2", () => {
    const expected = [...new Set(websiteLogos.map((logo) => logo.category))].sort().map((value) => ({ value, count: websiteLogos.filter((logo) => logo.category === value).length }));
    expect(catalogCategoryOptions(items)).toEqual(expected);
    expect(expected).toHaveLength(19);
    expect(expected.reduce((total, entry) => total + entry.count, 0)).toBe(websiteLogos.length);
    expect(expected.find((entry) => entry.value === "other")?.count).toBe(134);
    expect(expected.find((entry) => entry.value === "fintech")?.count).toBe(50);
  });
  it("returns the same brand identities for every category and multi-selection", () => {
    for (const entry of catalogCategoryOptions(items)) {
      const actual = items.filter((item) => matchesCategory(item.logo.category, [entry.value])).map((item) => item.logo.slug).sort();
      const expected = websiteLogos.filter((logo) => logo.category === entry.value).map((logo) => logo.slug).sort();
      expect(actual).toEqual(expected);
    }
    const chosen = ["commercial-bank", "fintech"];
    expect(items.filter((item) => matchesCategory(item.logo.category, chosen))).toHaveLength(75);
    expect(items.filter((item) => matchesCategory(item.logo.category, []))).toHaveLength(websiteLogos.length);
  });
  it("keeps real detail labels distinct from broad browse buckets", () => {
    for (const item of items) expect(displayCategory(item)).toBe(brandCategory(item.logo.slug, item.logo.category));
    const insurance = legacy.find((item) => item.displayName === "African Alliance Insurance")!;
    const investment = legacy.find((item) => item.logo.slug === "i-invest")!;
    expect(insurance.logo.category).toBe("other");
    expect(displayCategory(insurance)).toBe("Insurance company");
    expect(displayCategory(investment)).toBe("Finance App");
    expect(Number.isFinite(searchScore(insurance, "Insurance company"))).toBe(true);
    expect(insurance.categories).toContain("insurer");
  });
});
