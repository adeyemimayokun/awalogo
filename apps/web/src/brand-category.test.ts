import { describe, expect, it } from "vitest";
import { brandCategory } from "./brand-category";
import { runtimeCatalog } from "../../../packages/catalog-ui/src/logo-data";

describe("detail panel categories", () => {
  it("resolves card categories such as i-invest from institution metadata", () => {
    const item = runtimeCatalog.items.find((item) => item.logo.slug === "i-invest")!;
    expect(item.logo.category).toBe("other");
    expect(brandCategory(item.logo.slug, item.logo.category)).toBe("Finance App");
  });
  it("uses the institution's actual category instead of the broad logo bucket", () => {
    const item = runtimeCatalog.items.find((item) => item.logo.name === "African Alliance Insurance")!;
    expect(item.logo.category).toBe("other");
    expect(brandCategory(item.logo.slug, item.logo.category)).toBe("Insurance company");
  });
  it("uses the matching institution's primary category for shared brands", () => {
    expect(brandCategory("interswitch", "other")).toBe("Switching Processing");
  });
  it("retains a readable fallback when institution metadata is unavailable", () => {
    expect(brandCategory("not-in-catalog", "commercial-bank")).toBe("Commercial Bank");
  });
});
