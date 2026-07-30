import { describe, expect, it } from "vitest";
import {
  renderCompanySubmissionReceivedEmail,
  renderLogoLiveEmail,
  renderLogoRequestReceivedEmail,
  renderMaintainerLogoRequestEmail
} from "./email-templates.js";
import { publicLogoRequestSchema } from "./logo-requests.js";

const request = publicLogoRequestSchema.parse({
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

describe("awalogo email templates", () => {
  it("renders an accessible request confirmation with HTML and plain text", () => {
    const email = renderLogoRequestReceivedEmail(request, "https://github.com/adeyemimayokun/awalogo/issues/123");

    expect(email.subject).toBe("We received your Example Finance logo request");
    expect(email.html).toContain("<!doctype html>");
    expect(email.html).toContain("font-family:-apple-system");
    expect(email.html).toContain("#c9e45d");
    expect(email.html).toContain(
      '<img src="https://awalogo.com/awalogo-logo.png" width="60" height="40" alt="awalogo"'
    );
    expect(email.html).toContain("View public request");
    expect(email.text).toContain("Your email address is private");
  });

  it("includes the project links and usage footnote in HTML and plain text", () => {
    const email = renderLogoRequestReceivedEmail(request);

    expect(email.html).toContain('href="https://awalogo.com"');
    expect(email.html).toContain('href="https://github.com/adeyemimayokun/awalogo"');
    expect(email.html).toContain(
      'href="https://www.figma.com/community/plugin/1661356348996631383"'
    );
    expect(email.html).toContain(
      "Built for convenience — check each brand's guidelines before use."
    );
    expect(email.text).toContain("Website: https://awalogo.com");
    expect(email.text).toContain("GitHub: https://github.com/adeyemimayokun/awalogo");
    expect(email.text).toContain(
      "Figma Plugin: https://www.figma.com/community/plugin/1661356348996631383"
    );
    expect(email.text).toContain(
      "Built for convenience — check each brand's guidelines before use."
    );
  });

  it("keeps private contributor details in the maintainer template", () => {
    const email = renderMaintainerLogoRequestEmail(request);

    expect(email.subject).toBe("Logo request: Example Finance");
    expect(email.html).toContain("designer@example.com");
    expect(email.html).toContain("mailto:designer@example.com");
    expect(email.text).toContain("Notify when live: Yes");
  });

  it("renders the one-time live notification", () => {
    const email = renderLogoLiveEmail({
      institutionName: "Example Finance",
      logoUrl: "https://awalogo.com/",
      submissionId: request.submissionId
    });

    expect(email.subject).toBe("Example Finance is now live on awalogo");
    expect(email.html).toContain("View logo");
    expect(email.text).toContain("one-time availability update");
  });

  it("escapes submitted text before placing it in HTML", () => {
    const email = renderLogoLiveEmail({
      institutionName: "<img src=x onerror=alert(1)>",
      logoUrl: "javascript:alert(1)"
    });

    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img src=x");
    expect(email.html).not.toContain("javascript:");
  });

  it("includes a company-submission confirmation in the template set", () => {
    const email = renderCompanySubmissionReceivedEmail({
      companyName: "Example Finance",
      category: "Fintech",
      officialWebsite: "https://example.com",
      workEmail: "brand@example.com",
      submitterRole: "Brand manager",
      logoFormat: "SVG",
      logoAssetUrl: "https://example.com/logo.svg",
      brandGuidelinesUrl: "https://example.com/brand",
      notes: "Use the primary horizontal lockup.",
      submissionId: request.submissionId
    });

    expect(email.subject).toContain("Example Finance");
    expect(email.html).toContain("Submission received");
    expect(email.text).toContain("official logo submission is under review");
  });
});
