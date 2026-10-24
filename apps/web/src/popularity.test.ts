import { describe, expect, it } from "vitest";
import { popularityScore, sortBrands } from "./popularity";

const brand = (slug: string, name: string, added_at = "2026-01-01") => ({ slug, name, added_at });
describe("brand popularity", () => {
  it("starts with prominent companies without fabricated download counts", () => {
    expect(sortBrands([brand("unknown", "A"), brand("paystack-payment", "Paystack")], "popular", {})[0].slug).toBe("paystack-payment");
  });
  it("lets download demand reorder companies with the same baseline", () => {
    expect(sortBrands([brand("a", "A"), brand("b", "B")], "popular", { b: 50 })[0].slug).toBe("b");
  });
  it("ignores invalid counts and caps download influence", () => {
    expect(popularityScore("a", { a: -5 })).toBe(popularityScore("a", {}));
    expect(popularityScore("a", { a: NaN })).toBe(popularityScore("a", {}));
    expect(popularityScore("a", { a: 1000000 })).toBe(popularityScore("a", { a: 1000 }));
  });
  it("keeps alphabetical and newest choices deterministic without mutation", () => {
    const items = [brand("b", "B", "2026-02-01"), brand("a", "A")];
    expect(sortBrands(items, "name", {}).map((item) => item.slug)).toEqual(["a", "b"]);
    expect(sortBrands(items, "newest", {})[0].slug).toBe("b");
    expect(items[0].slug).toBe("b");
  });
});
