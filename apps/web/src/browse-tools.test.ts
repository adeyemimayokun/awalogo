import { describe, expect, it } from "vitest";
import { nameSimilarity, paginate, pageWindow, recommendBrands, shortcut } from "./browse-tools";

describe("default result pagination", () => {
  it("shows three previous and two next pages without padding at the edges", () => {
    expect(pageWindow(1, 16)).toEqual([1, 2, 3]);
    expect(pageWindow(8, 16)).toEqual([5, 6, 7, 8, 9, 10]);
    expect(pageWindow(16, 16)).toEqual([13, 14, 15, 16]);
    expect(pageWindow(1, 2)).toEqual([1, 2]);
  });
  it("covers all results once with 20 per page and a shorter final page", () => {
    const items = Array.from({ length: 47 }, (_, i) => i);
    expect([1, 2, 3].flatMap((page) => paginate(items, page).items)).toEqual(items);
    expect(paginate(items, 1).items).toHaveLength(20);
    expect(paginate(items, 3)).toMatchObject({ start:41, end:47, pages:3 });
    expect(paginate(items, 99).current).toBe(3);
    expect(paginate([], 1)).toMatchObject({ items:[], start:0, end:0 });
  });
});
describe("search recommendations", () => {
  const brands = ["Acme", "Acne", "Other", "Zebra"].map((name) => ({ name, slug:name.toLowerCase(), aliases:[] }));
  it("excludes direct results and puts sourced relationships before fuzzy matches", () => {
    const results = recommendBrands(brands, [brands[0]], "Acme", [{ slugs:["acme", "other"], source_url:"https://example.com/company" }]);
    expect(results.map((entry) => entry.brand.name)).toEqual(["Other", "Acne"]);
    expect(results[0].related).toBe(true);
    expect(recommendBrands(brands, [], "Zebar", [])[0].brand.name).toBe("Zebra");
  });
  it("omits unrelated, short-query and empty-query suggestions", () => {
    for (const query of ["", "a", "completely unrelated"]) expect(recommendBrands(brands, [], query, [])).toEqual([]);
    expect(recommendBrands(brands, [brands[0]], "Acme", [{ slugs:["acme", "other"], source_url:"" }]).some((entry) => entry.related)).toBe(false);
    expect(nameSimilarity("Café", "Cafe")).toBe(1);
  });
  it("limits suggestions to eight eligible candidates", () => {
    const many = Array.from({ length:20 }, (_, i) => ({ name:`Acme ${i}`, slug:`acme-${i}`, aliases:[] }));
    expect(recommendBrands(many, [], "Acme", [])).toHaveLength(8);
  });
});
describe("shortcut routing", () => {
  const event = { key:"/", altKey:false, ctrlKey:false, metaKey:false, shiftKey:false, repeat:false, isComposing:false };
  it("routes search, bag and request shortcuts", () => {
    expect(shortcut(event, false)).toBe("search");
    expect(shortcut({ ...event, key:"b", altKey:true }, false)).toBe("bag");
    expect(shortcut({ ...event, key:"r", altKey:true }, false)).toBe("request");
  });
  it("ignores editing, composition, repeats and conflicting modifiers", () => {
    expect(shortcut(event, true)).toBeUndefined();
    for (const key of ["ctrlKey", "metaKey", "shiftKey", "repeat", "isComposing"]) expect(shortcut({ ...event, [key]:true }, false)).toBeUndefined();
    expect(shortcut({ ...event, key:"Delete" }, false)).toBeUndefined();
  });
});
