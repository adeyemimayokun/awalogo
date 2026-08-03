import { z } from "zod";

const httpUrl = z.string().trim().url().refine(
  (value) => /^https?:/.test(new URL(value).protocol),
  "Enter a valid website URL"
);

const optionalHttpsUrl = z.union([
  z.literal(""),
  z.string().url().refine((value) => new URL(value).protocol === "https:", "Drive links must use HTTPS")
]);

export const publicLogoRequestSchema = z.object({
  submissionId: z.string().uuid(),
  institutionName: z.string().trim().min(2).max(120),
  officialWebsite: httpUrl,
  email: z.string().trim().email().max(254),
  category: z.enum([
    "Bank",
    "Finance app",
    "Fintech",
    "Insurance",
    "Investment platform",
    "Payments",
    "Other"
  ]),
  logoAssetUrl: optionalHttpsUrl,
  notifyWhenAvailable: z.boolean(),
  websiteConfirm: z.literal("").optional().default("")
});

export type PublicLogoRequest = z.infer<typeof publicLogoRequestSchema>;

export function buildPublicIssue(request: PublicLogoRequest): { title: string; body: string } {
  return {
    title: `Logo request: ${request.institutionName}`,
    body: [
      "## Institution",
      request.institutionName,
      "",
      "## Category",
      request.category,
      "",
      "## Official website",
      request.officialWebsite,
      "",
      "## Submitted logo artwork",
      request.logoAssetUrl
        ? "A private sharing link was supplied to the maintainers."
        : "Not provided.",
      "",
      "## Availability notification",
      request.notifyWhenAvailable
        ? "Requested. Contact details are held privately by the maintainers."
        : "Not requested.",
      "",
      "---",
      "Submitted through awalogo.com. Contributor contact details and supplied asset links are withheld from this public request."
    ].join("\n")
  };
}

export function buildMaintainerEmail(request: PublicLogoRequest): { subject: string; text: string } {
  return {
    subject: `Logo request: ${request.institutionName.replace(/[\r\n]+/g, " ")}`,
    text: [
      "A new logo request was submitted through awalogo.com.",
      "",
      `Company or product: ${request.institutionName}`,
      `Type of company: ${request.category}`,
      `Company website: ${request.officialWebsite}`,
      `Contributor email: ${request.email}`,
      `Logo file link: ${request.logoAssetUrl || "Not provided"}`,
      `Notify when available: ${request.notifyWhenAvailable ? "Yes" : "No"}`,
      "",
      `Submission ID: ${request.submissionId}`
    ].join("\n")
  };
}
