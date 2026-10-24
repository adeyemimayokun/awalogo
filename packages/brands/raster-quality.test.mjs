import { describe, expect, it } from "vitest";
import { withoutRasterEnlargement } from "../../scripts/lib/raster-quality.mjs";

describe("V2 raster quality policy", () => {
  it("never enlarges new raster sources, including when a caller requests enlargement", () => {
    for (const format of ["png", "webp", "jpeg"]) {
      expect(withoutRasterEnlargement({ slug: "new", without_enlargement: false }, { format, checksum: "new-source" }, {})).toBe(true);
    }
  });
  it("preserves exact historical outputs without grandfathering replacement sources", () => {
    const compatibility = { old: "approved-source" };
    expect(withoutRasterEnlargement({ slug: "old" }, { format: "png", checksum: "approved-source" }, compatibility)).toBe(false);
    expect(withoutRasterEnlargement({ slug: "old" }, { format: "png", checksum: "replacement" }, compatibility)).toBe(true);
    expect(withoutRasterEnlargement({ slug: "old", without_enlargement: true }, { format: "png", checksum: "approved-source" }, compatibility)).toBe(true);
    expect(withoutRasterEnlargement({ slug: "vector" }, { format: "svg", checksum: "svg" }, {})).toBe(false);
  });
});
