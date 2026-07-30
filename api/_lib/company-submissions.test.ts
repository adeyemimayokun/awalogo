import { describe, expect, it } from "vitest";
import {
  buildPublicCompanySubmissionIssue,
  companyLogoSubmissionSchema
} from "./company-submissions.js";

const submission = companyLogoSubmissionSchema.parse({
  submissionId: "a0ec6ec5-6dde-4bea-b5c4-3cfdcb9b65fe",
  companyName: "Example Finance",
  officialWebsite: "https://example.com/",
  workEmail: "brand@example.com",
  category: "Fintech",
  submitterRole: "Brand manager",
  logoFormat: "SVG",
  logoAssetUrl: "https://example.com/logo.svg",
  brandGuidelinesUrl: "https://example.com/brand/",
  notes: "Use the primary horizontal lockup.",
  rightsConfirmed: true,
  websiteConfirm: ""
});

describe("company logo submissions", () => {
  it("keeps the work email out of the public issue", () => {
    const issue = buildPublicCompanySubmissionIssue(submission);

    expect(issue.title).toBe("Company logo submission: Example Finance");
    expect(issue.body).toContain("https://example.com/logo.svg");
    expect(issue.body).toContain("authorized");
    expect(issue.body).not.toContain("brand@example.com");
  });

  it("requires authorization and HTTPS file links", () => {
    expect(() => companyLogoSubmissionSchema.parse({
      ...submission,
      rightsConfirmed: false
    })).toThrow();

    expect(() => companyLogoSubmissionSchema.parse({
      ...submission,
      logoAssetUrl: "http://example.com/logo.svg"
    })).toThrow();
  });
});
