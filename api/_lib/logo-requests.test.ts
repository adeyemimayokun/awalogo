import { describe, expect, it } from "vitest";
import {
  buildMaintainerEmail,
  buildPublicIssue,
  publicLogoRequestSchema
} from "./logo-requests.js";

const validRequest = publicLogoRequestSchema.parse({
  submissionId: "a0ec6ec5-6dde-4bea-b5c4-3cfdcb9b65fe",
  institutionName: "Example Finance",
  officialWebsite: "https://example.com/",
  email: "designer@example.com",
  category: "Finance app",
  logoFormat: "SVG",
  logoAssetUrl: "https://drive.google.com/file/d/example/view",
  notifyWhenAvailable: true,
  websiteConfirm: ""
});

describe("public logo requests", () => {
  it("keeps the contributor email out of the public issue", () => {
    const issue = buildPublicIssue(validRequest);

    expect(issue.title).toBe("Logo request: Example Finance");
    expect(issue.body).toContain("https://drive.google.com/file/d/example/view");
    expect(issue.body).toContain("- Format: SVG");
    expect(issue.body).not.toContain("designer@example.com");
    expect(issue.body).toContain("contact details are withheld");
    expect(issue.body).toContain("Availability notification");
    expect(issue.body).toContain("Requested.");
  });

  it("includes the private reply address in the maintainer email", () => {
    const email = buildMaintainerEmail(validRequest);

    expect(email.subject).toBe("Logo request: Example Finance");
    expect(email.text).toContain("Contributor email: designer@example.com");
    expect(email.text).toContain("Notify when available: Yes");
    expect(email.text).toContain("Submission ID: a0ec6ec5-6dde-4bea-b5c4-3cfdcb9b65fe");
  });

  it("rejects an insecure drive link and a filled spam trap", () => {
    expect(() => publicLogoRequestSchema.parse({
      ...validRequest,
      logoAssetUrl: "http://example.com/logo.svg"
    })).toThrow();

    expect(() => publicLogoRequestSchema.parse({
      ...validRequest,
      websiteConfirm: "https://spam.example"
    })).toThrow();
  });
});
