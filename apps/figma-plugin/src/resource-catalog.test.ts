import { describe, expect, it } from "vitest";
import brands from "../../../packages/brands/catalog.json";
import history from "../../../packages/brands/historical-catalog.json";
import flags from "../../web/src/generated/flags.json";
import { parseResources } from "./resource-catalog";
import { searchScore } from "./catalog-search";

const remap = (formats: Array<{ url: string }>) => formats.map((format) => ({ ...format, repository_path: `assets/${format.url.split("/").at(-1)}`, url: `/catalog/plugin/v2/assets/${format.url.split("/").at(-1)}` }));
const data = { schema_version: 2, items: brands.brands.map((brand) => ({ kind: "company", categories: [brand.industry], logo: { ...brand, category: brand.industry, formats: remap(brand.formats), variations: history.variations.filter((item) => item.slug === brand.slug).map((item) => ({ ...item, status: "old", formats: remap(item.formats) })) } })) };
describe("additive plugin resource catalog", () => {
  it("keeps companies separate from financial institution records and preserves source review status", () => {
    const items = parseResources(data, "https://www.awalogo.com");
    expect(items).toHaveLength(brands.brands.length);
    expect(items.every((item) => item.institutions.length === 0 && !item.institution)).toBe(true);
    expect(items.find((item) => item.logo.slug === "airtel-nigeria")?.categories).toEqual(["telecommunications"]);
    const t2 = items.find((item) => item.logo.slug === "t2-mobile")!;
    expect(t2.logo.variations.some((item) => item.id === "9mobile-previous")).toBe(true);
    expect(Number.isFinite(searchScore(t2, "9mobile"))).toBe(true);
    expect(Number.isFinite(searchScore(t2, "9 mobile"))).toBe(true);
    expect(items.every((item) => item.logo.formats.every((format) => item.logo.asset_urls[format.type]?.startsWith("https://www.awalogo.com/catalog/plugin/v2/assets/")))).toBe(true);
  });
  it("rejects duplicate identities, untrusted paths and community artwork presented as verified", () => {
    expect(() => parseResources({ ...data, items: [data.items[0], data.items[0]] }, "https://www.awalogo.com")).toThrow();
    const copy = structuredClone(data);
    copy.items[0].logo.formats[0].url = "https://untrusted.example/asset.svg";
    expect(() => parseResources(copy, "https://www.awalogo.com")).toThrow();
    const provenance = structuredClone(data);
    provenance.items[0].logo.source_type = "community-catalog";
    provenance.items[0].logo.status = "verified";
    expect(() => parseResources(provenance, "https://www.awalogo.com")).toThrow();
  });
  it("supports every flag and both aspect ratios without official-company verification claims", () => {
    const items = parseResources({ schema_version: 2, items: flags.countries.map((flag) => ({ kind: "flag", categories: [flag.region], logo: {
      name: `${flag.name} flag`, slug: `flag-${flag.code.toLowerCase()}`, category: flag.region, aliases: [flag.code], website: flags.source, source_url: flags.source, source_type: "flag-icons (MIT)", status: "needs-review", added_at: "2026-10-18", updated_at: "2026-10-18", formats: remap(flag.variants[0].formats), variations: flag.variants.slice(1).map((variation) => ({ ...variation, status: "active", formats: remap(variation.formats) }))
    } })) }, "https://www.awalogo.com");
    expect(items).toHaveLength(249);
    expect(items.every((item) => item.logo.variations.length === 1 && item.logo.status === "needs-review")).toBe(true);
  });
});
