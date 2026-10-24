import { describe, expect, it } from "vitest";
import catalog from "./catalog.json";
import { logos, matchesBrandScope } from "../../apps/web/src/v2-brand-data";

describe("reviewed record-label additions", () => {
  it("publishes the four labels in the Nigerian media collection", () => {
    for (const slug of ["ybnl-nation", "mavin-records", "chocolate-city", "dapper-music"]) {
      const brand = catalog.brands.find((item) => item.slug === slug)!;
      expect(brand).toBeDefined();
      expect(brand.industry).toBe("media-entertainment");
      expect(matchesBrandScope(slug,"media-entertainment","NG")).toBe(true);
      expect(brand.formats.map((item) => item.type)).toEqual(expect.arrayContaining(["png","webp"]));
      expect(logos.some((item) => item.slug === slug)).toBe(true);
    }
  });
  it("never marks community YBNL artwork as officially verified", () => {
    const brand = catalog.brands.find((item) => item.slug === "ybnl-nation")!;
    expect(brand.source_type).toBe("community-catalog");
    expect(brand.status).toBe("needs-review");
    expect(brand.aliases).toContain("YBNL");
    expect(brand.formats.some((asset) => asset.type === "svg")).toBe(false);
  });
});
