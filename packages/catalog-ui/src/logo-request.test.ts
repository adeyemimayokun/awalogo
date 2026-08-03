import { describe, expect, it } from "vitest";
import { buildCompanyLogoSubmissionUrl } from "./logo-request";

describe("company logo submission issue", () => {
  it("builds a verified company submission with asset details", () => {
    const url = new URL(buildCompanyLogoSubmissionUrl({
      companyName: "Example Finance",
      officialWebsite: "https://example.com/",
      workEmail: "brand@example.com",
      category: "Fintech",
      submitterRole: "Brand manager",
      logoFormat: "SVG",
      logoAssetUrl: "https://example.com/brand/logo.svg",
      brandGuidelinesUrl: "https://example.com/brand/",
      notes: "Use the primary horizontal lockup.",
      rightsConfirmed: true
    }));

    expect(url.searchParams.get("template")).toBe("company-logo-submission.md");
    expect(url.searchParams.get("title")).toBe("Company logo submission: Example Finance");
    expect(url.searchParams.get("body")).toContain("https://example.com/brand/logo.svg");
    expect(url.searchParams.get("body")).toContain("brand@example.com");
    expect(url.searchParams.get("body")).toContain("authorized to submit");
  });
});
