import { z } from "zod";

const requiredHttpUrl = z.string().url().refine(
  (value) => /^https?:$/.test(new URL(value).protocol),
  "Enter a valid official website URL"
);

const optionalHttpsUrl = z.union([
  z.literal(""),
  z.string().url().refine(
    (value) => new URL(value).protocol === "https:",
    "Shared file links must use HTTPS"
  )
]);

export const companyLogoSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  companyName: z.string().trim().min(2).max(120),
  officialWebsite: requiredHttpUrl,
  workEmail: z.string().trim().email().max(254),
  category: z.enum([
    "Bank",
    "Fintech",
    "Insurance",
    "Investment platform",
    "Payments",
    "Remittance",
    "Other"
  ]),
  submitterRole: z.string().trim().max(100),
  logoFormat: z.enum(["SVG", "PNG", "WebP", "Multiple formats", "Brand kit"]),
  logoAssetUrl: optionalHttpsUrl,
  brandGuidelinesUrl: optionalHttpsUrl,
  notes: z.string().trim().max(1500),
  rightsConfirmed: z.literal(true),
  websiteConfirm: z.literal("").optional().default("")
});

export type CompanyLogoSubmission = z.infer<typeof companyLogoSubmissionSchema>;

export function buildPublicCompanySubmissionIssue(
  submission: CompanyLogoSubmission
): { title: string; body: string } {
  return {
    title: `Company logo submission: ${submission.companyName}`,
    body: [
      "## Company",
      submission.companyName,
      "",
      "## Official website",
      submission.officialWebsite,
      "",
      "## Category",
      submission.category,
      "",
      "## Submitter role",
      submission.submitterRole || "Not provided",
      "",
      "## Logo artwork",
      `- Format: ${submission.logoFormat}`,
      `- Public file link: ${submission.logoAssetUrl || "Not provided"}`,
      `- Brand guidelines: ${submission.brandGuidelinesUrl || "Not provided"}`,
      "",
      "## Notes",
      submission.notes || "None",
      "",
      "## Authorization",
      "- [x] The submitter confirmed that they are authorized to provide the current official artwork.",
      "",
      "---",
      "Submitted through awalogo.com. Contributor contact details are held privately by maintainers."
    ].join("\n")
  };
}
