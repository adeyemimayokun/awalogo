import { describe, expect, it } from "vitest";
import {
  buildPublicIssue,
  publicLogoRequestSchema
} from "./logo-requests.js";

const validRequest = publicLogoRequestSchema.parse({
  submissionId: "a0ec6ec5-6dde-4bea-b5c4-3cfdcb9b65fe",
  institutionName: "Example Finance",
  officialWebsite: "https://example.com/",
  email: "designer@example.com",
  category: "Finance app",
  logoAssetUrl: "https://drive.google.com/file/d/example/view",
  notifyWhenAvailable: true,
  websiteConfirm: ""
});

describe("public logo requests", () => {
  it("keeps the contributor email out of the public issue", () => {
    const issue = buildPublicIssue(validRequest);

    expect(issue.title).toBe("Logo request: Example Finance");
    expect(issue.body).not.toContain("https://drive.google.com/file/d/example/view");
    expect(issue.body).not.toContain("designer@example.com");
    expect(issue.body).toContain("asset links are withheld");
    expect(issue.body).toContain("Availability notification");
    expect(issue.body).toContain("Requested.");
  });

  it("requires an official website", () => {
    expect(() => publicLogoRequestSchema.parse({
      ...validRequest,
      officialWebsite: ""
    })).toThrow();
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
