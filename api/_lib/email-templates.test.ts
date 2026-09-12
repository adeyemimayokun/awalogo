import { describe, expect, it } from "vitest";
import {
  maintainerLogoRequestTemplate,
  requesterLogoRequestTemplate
} from "./email-templates";

const request = {
  submissionId: "a0ec6ec5-6dde-4bea-b5c4-3cfdcb9b65fe",
  institutionName: "Example <Finance>",
  officialWebsite: "https://example.com/",
  email: "designer@example.com",
  category: "Fintech" as const,
  logoAssetUrl: "https://drive.google.com/file/example",
  notifyWhenAvailable: true,
  websiteConfirm: "" as const
};

describe("logo request email templates", () => {
  it("renders the maintainer notification with branded HTML and a text fallback", () => {
    const email = maintainerLogoRequestTemplate(request);

    expect(email.subject).toBe("Logo request: Example <Finance>");
    expect(email.html).toContain("awalogo");
    expect(email.html).toContain("Example &lt;Finance&gt;");
    expect(email.html).not.toContain("Example <Finance>");
    expect(email.text).toContain("Contributor email: designer@example.com");
    expect(email.text).toContain(`Submission ID: ${request.submissionId}`);
  });

  it("renders a separate requester confirmation without maintainer-only details", () => {
    const email = requesterLogoRequestTemplate(request);

    expect(email.subject).toContain("We received your Example <Finance> logo request");
    expect(email.html).toContain("Request received");
    expect(email.text).toContain("Thanks for helping awalogo grow");
    expect(email.text).not.toContain("Contributor email");
    expect(email.text).not.toContain("Logo file link");
  });
});
