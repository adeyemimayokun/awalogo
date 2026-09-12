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
