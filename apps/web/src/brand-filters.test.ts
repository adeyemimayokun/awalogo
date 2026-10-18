import { describe, expect, it } from "vitest";
import { filterBrands, toggleCategory } from "./brand-filters";

const brands = [
  { name: "Example Bank", category: "commercial-bank", aliases: ["EB"] },
  { name: "Example Pay", category: "fintech", aliases: [] },
  { name: "Example Insurance", category: "other", aliases: [] }
];
describe("multi-category filtering", () => {
  it("finds rebrands despite spaces, punctuation, case and diacritics", () => {
    const rebrands = [{ name: "T2 Mobile", category: "telecommunications", aliases: ["9mobile", "Etisalat Nigeria"] }];
    for (const query of ["9 mobile", "9-mobile", "9 MOBILE", "9mobile", "t2mobile", "Etisalat Nigeria"]) expect(filterBrands(rebrands, [], query)).toEqual(rebrands);
    expect(filterBrands(rebrands, ["fintech"], "9 mobile")).toEqual([]);
    expect(filterBrands([{ name: "Côte d’Ivoire", category: "other", aliases: [] }], [], "cote d ivoire")).toHaveLength(1);
  });
  it("matches any selected category, combined with the search", () => {
    expect(filterBrands(brands, ["commercial-bank", "fintech"], "example")).toHaveLength(2);
    expect(filterBrands(brands, ["commercial-bank", "fintech"], " EB ")).toEqual([brands[0]]);
  });
  it("shows all categories when selection is empty", () => {
    expect(filterBrands(brands, [], "")).toEqual(brands);
  });
  it("toggles selections without duplicates or changing the input", () => {
    const selected = ["fintech"];
    expect(toggleCategory(selected, "commercial-bank")).toEqual(["fintech", "commercial-bank"]);
    expect(toggleCategory(selected, "fintech")).toEqual([]);
    expect(selected).toEqual(["fintech"]);
  });
  it("clears every selected category with the all action", () => {
    expect(toggleCategory(["fintech", "other"], "all")).toEqual([]);
  });
});
