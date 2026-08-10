import { describe, expect, it } from "vitest";
import generatedRuntimeCatalog from "../../../packages/catalog-ui/src/generated/runtime-catalog.json";
import { parseRuntimeCatalog } from "@awalogo/catalog-ui/runtime-catalog";
import { availableCategories, catalogItemsFromRuntime } from "./catalog-data";

const catalog = parseRuntimeCatalog(generatedRuntimeCatalog);
const items = catalogItemsFromRuntime(catalog);

describe("runtime institution catalog", () => {
  it("contains only logo-linked public institutions", () => {
    expect(items).toHaveLength(catalog.items.length);
    expect(items.every((item) => item.logo.formats.length > 0)).toBe(true);
    expect(items.some((item) => item.institutions.some((institution) => institution.slug === "passpoint"))).toBe(false);
  });

  it("preserves canonical families, variations, and review states", () => {
    const paga = items.find((item) => item.logo.slug === "paga");
    const sycamore = items.find((item) => item.logo.slug === "sycamore-integrated-solutions");
    const nomba = items.find((item) => item.logo.slug === "nomba");

    expect(paga?.institutions.map((institution) => institution.slug)).toEqual(expect.arrayContaining(["paga-remit", "pagatech"]));
    expect(sycamore?.logo.variations.some((variation) => variation.id === "symbol")).toBe(true);
    expect(nomba?.logo.status).toBe("needs-review");
  });

  it("derives available categories from the live items", () => {
    const categories = availableCategories(items);
    expect(categories).toContain("commercial-bank");
    expect(categories).toContain("fintech");
  });
});
