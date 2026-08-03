import { describe, expect, it } from "vitest";
import { getCatalogLogoBadge } from "./catalog-badge";

const latestLogoAddedAt = "2026-08-02";

describe("catalog logo badges", () => {
  it("marks verified logos from the latest catalog batch as new", () => {
    expect(getCatalogLogoBadge({
      added_at: latestLogoAddedAt,
      status: "verified"
    }, latestLogoAddedAt)).toBe("new");
  });

  it("does not badge logos that still need review", () => {
    expect(getCatalogLogoBadge({
      added_at: latestLogoAddedAt,
      status: "needs-review"
    }, latestLogoAddedAt)).toBeNull();
  });

  it("does not badge older, deprecated, or missing logos", () => {
    expect(getCatalogLogoBadge({
      added_at: "2026-07-31",
      status: "verified"
    }, latestLogoAddedAt)).toBeNull();
    expect(getCatalogLogoBadge({
      added_at: latestLogoAddedAt,
      status: "deprecated"
    }, latestLogoAddedAt)).toBeNull();
    expect(getCatalogLogoBadge(null, latestLogoAddedAt)).toBeNull();
  });
});
