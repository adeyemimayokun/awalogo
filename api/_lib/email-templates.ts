import type { PublicLogoRequest } from "./logo-requests.js";

export type EmailTemplate = {
  subject: string;
  preview: string;
  html: string;
  text: string;
};

export type LogoLiveEmailInput = {
  institutionName: string;
  logoUrl: string;
  submissionId?: string;
};

export type CompanySubmissionEmailInput = {
  companyName: string;
  category: string;
  officialWebsite: string;
  workEmail: string;
  submitterRole: string;
  logoFormat: string;
  logoAssetUrl: string;
  brandGuidelinesUrl: string;
  notes: string;
  submissionId: string;
};

type Detail = {
  label: string;
  value: string;
};

type ShellInput = {
  preview: string;
  eyebrow: string;
  title: string;
  body: string[];
  details?: Detail[];
  action?: {
    label: string;
    url: string;
  };
  note?: string;
};

const colors = {
  page: "#f4f5f1",
  panel: "#ffffff",
  ink: "#292a27",
  muted: "#737373",
  border: "#e2e4de",
  soft: "#f8f9f5",
  accent: "#c9e45d",
  accentInk: "#34400f"
};

const footerLinks = {
  website: "https://awalogo.com",
  github: "https://github.com/adeyemimayokun/awalogo",
  figmaPlugin: "https://www.figma.com/community/plugin/1661356348996631383"
};

const brandLogoUrl = "https://awalogo.com/awalogo-logo.png";
const footerNote = "Built for convenience — check each brand's guidelines before use.";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    return /^(https?:|mailto:)$/.test(url.protocol) ? url.href : "https://awalogo.com";
  } catch {
    return "https://awalogo.com";
  }
}

function normalizeSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function detailsHtml(details: Detail[]): string {
  return details.map(({ label, value }, index) => `
    <tr>
      <td style="padding:${index === 0 ? "0" : "15px"} 0 5px;color:${colors.muted};font-size:12px;line-height:1.4;text-transform:uppercase;">
        ${escapeHtml(label)}
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 ${index === details.length - 1 ? "0" : "1px"};color:${colors.ink};font-size:15px;font-weight:600;line-height:1.5;word-break:break-word;">
        ${escapeHtml(value)}
      </td>
    </tr>`).join("");
}

function renderShell(input: ShellInput): string {
  const bodyHtml = input.body
    .map((paragraph) => `<p style="margin:0 0 14px;color:${colors.muted};font-size:16px;font-weight:400;line-height:1.65;">${escapeHtml(paragraph)}</p>`)
    .join("");
  const details = input.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid ${colors.border};background:${colors.soft};">
        <tr><td style="padding:20px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailsHtml(input.details)}</table></td></tr>
      </table>`
    : "";
  const action = input.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 8px;">
        <tr>
          <td bgcolor="${colors.accent}" style="border-radius:5px;">
            <a href="${escapeHtml(safeUrl(input.action.url))}" style="display:inline-block;padding:14px 20px;color:${colors.ink};font-size:15px;font-weight:700;line-height:1;text-decoration:none;">${escapeHtml(input.action.label)}</a>
          </td>
        </tr>
      </table>`
    : "";
  const note = input.note
    ? `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${colors.border};color:${colors.muted};font-size:13px;line-height:1.6;">${escapeHtml(input.note)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${colors.page};color:${colors.ink};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preview)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.page};">
      <tr>
        <td align="center" style="padding:34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border:1px solid ${colors.border};background:${colors.panel};">
            <tr><td style="height:4px;background:${colors.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:22px 30px;border-bottom:1px solid ${colors.border};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <a href="${footerLinks.website}" style="display:inline-block;text-decoration:none;">
                        <img src="${brandLogoUrl}" width="60" height="40" alt="awalogo" style="display:block;width:60px;height:40px;border:0;">
                      </a>
                    </td>
                    <td align="right" style="color:${colors.muted};font-size:12px;line-height:1;">Nigerian financial logos</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 30px 36px;">
                <p style="margin:0 0 13px;color:${colors.accentInk};font-size:12px;font-weight:700;line-height:1.3;text-transform:uppercase;">${escapeHtml(input.eyebrow)}</p>
                <h1 style="margin:0 0 18px;color:${colors.ink};font-size:30px;font-weight:700;letter-spacing:0;line-height:1.16;">${escapeHtml(input.title)}</h1>
                ${bodyHtml}
                ${details}
                ${action}
                ${note}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 30px;border-top:1px solid ${colors.border};color:${colors.muted};font-size:12px;line-height:1.6;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
                  <tr>
                    <td style="padding:0 18px 0 0;">
                      <a href="${footerLinks.website}" style="color:${colors.ink};font-weight:600;text-decoration:underline;">Website</a>
                    </td>
                    <td style="padding:0 18px 0 0;">
                      <a href="${footerLinks.github}" style="color:${colors.ink};font-weight:600;text-decoration:underline;">GitHub</a>
                    </td>
                    <td>
                      <a href="${footerLinks.figmaPlugin}" style="color:${colors.ink};font-weight:600;text-decoration:underline;">Figma Plugin</a>
                    </td>
                  </tr>
                </table>
                ${footerNote}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function formatDetails(details: Detail[]): string {
  return details.map(({ label, value }) => `${label}: ${value}`).join("\n");
}

function withTextFooter(content: string): string {
  return [
    content,
    "",
    "---",
    `Website: ${footerLinks.website}`,
    `GitHub: ${footerLinks.github}`,
    `Figma Plugin: ${footerLinks.figmaPlugin}`,
    "",
    footerNote
  ].join("\n");
}

export function renderLogoRequestReceivedEmail(
  request: PublicLogoRequest,
  issueUrl?: string
): EmailTemplate {
  const institutionName = normalizeSubject(request.institutionName);
  const preview = `We received your request for ${institutionName}.`;
  const details: Detail[] = [
    { label: "Company or product", value: institutionName },
    { label: "Type", value: request.category },
    { label: "Notification", value: request.notifyWhenAvailable ? "Email me when it is live" : "No live notification requested" },
    { label: "Reference", value: request.submissionId }
  ];
  const body = [
    "Thanks for helping awalogo grow. The maintainers have received your request and will review the brand source and artwork.",
    request.notifyWhenAvailable
      ? "You asked for a one-time email when the logo becomes available. We will send it to this address after the catalog entry is live."
      : "We will only contact you if the maintainers need more information about this request."
  ];
  const action = issueUrl ? { label: "View public request", url: issueUrl } : undefined;
  const text = [
    "REQUEST RECEIVED",
    "",
    "Your logo request is with the awalogo team.",
    "",
    ...body,
    "",
    formatDetails(details),
    issueUrl ? `\nView public request: ${issueUrl}` : "",
    "",
    "Your email address is private and is not included in the public GitHub issue."
  ].filter(Boolean).join("\n");

  return {
    subject: `We received your ${institutionName} logo request`,
    preview,
    html: renderShell({
      preview,
      eyebrow: "Request received",
      title: "Your logo request is with the awalogo team.",
      body,
      details,
      action,
      note: "Your email address is private and is not included in the public GitHub issue."
    }),
    text: withTextFooter(text)
  };
}

export function renderMaintainerLogoRequestEmail(request: PublicLogoRequest): EmailTemplate {
  const institutionName = normalizeSubject(request.institutionName);
  const preview = `New request for ${institutionName} from awalogo.com.`;
  const details: Detail[] = [
    { label: "Company or product", value: institutionName },
    { label: "Type", value: request.category },
    { label: "Company website", value: request.officialWebsite || "Not provided" },
    { label: "Contributor email", value: request.email },
    { label: "Logo file", value: `${request.logoFormat} / ${request.logoAssetUrl || "No link provided"}` },
    { label: "Notify when live", value: request.notifyWhenAvailable ? "Yes" : "No" },
    { label: "Submission ID", value: request.submissionId }
  ];
  const body = ["A new logo request was submitted through awalogo.com and is ready for source and asset review."];
  const text = [
    "NEW LOGO REQUEST",
    "",
    "A new logo request is ready to review.",
    "",
    ...body,
    "",
    formatDetails(details)
  ].join("\n");

  return {
    subject: `Logo request: ${institutionName}`,
    preview,
    html: renderShell({
      preview,
      eyebrow: "New logo request",
      title: "A new logo request is ready to review.",
      body,
      details,
      action: { label: "Reply to contributor", url: `mailto:${request.email}` },
      note: "Contributor details are private. Do not add the email address to the public catalog or GitHub issue."
    }),
    text: withTextFooter(text)
  };
}

export function renderLogoLiveEmail(input: LogoLiveEmailInput): EmailTemplate {
  const institutionName = normalizeSubject(input.institutionName);
  const preview = `${institutionName} is now available on awalogo.`;
  const details: Detail[] = [
    { label: "Logo", value: institutionName },
    ...(input.submissionId ? [{ label: "Request reference", value: input.submissionId }] : [])
  ];
  const body = [
    `Good news. ${institutionName} has been reviewed and is now available in the awalogo catalog.`,
    "You can preview the asset, check the available formats, and download the version that suits your project."
  ];
  const text = [
    "LOGO NOW LIVE",
    "",
    `${institutionName} is ready to use.`,
    "",
    ...body,
    "",
    formatDetails(details),
    "",
    `View logo: ${safeUrl(input.logoUrl)}`,
    "",
    "This is the one-time availability update requested when the logo was submitted."
  ].join("\n");

  return {
    subject: `${institutionName} is now live on awalogo`,
    preview,
    html: renderShell({
      preview,
      eyebrow: "Logo now live",
      title: `${institutionName} is ready to use.`,
      body,
      details,
      action: { label: "View logo", url: input.logoUrl },
      note: "This is the one-time availability update requested when the logo was submitted."
    }),
    text: withTextFooter(text)
  };
}

export function renderCompanySubmissionReceivedEmail(
  input: CompanySubmissionEmailInput
): EmailTemplate {
  const companyName = normalizeSubject(input.companyName);
  const preview = `awalogo received the official artwork submission for ${companyName}.`;
  const details: Detail[] = [
    { label: "Company", value: companyName },
    { label: "Category", value: input.category },
    { label: "Primary format", value: input.logoFormat },
    { label: "Reference", value: input.submissionId }
  ];
  const body = [
    "Thanks for sending current official artwork to awalogo. The maintainers will verify the source, review the files, and check that the logo is ready for the public catalog.",
    "A maintainer may reply to this address if a different lockup, source, or brand guideline is needed."
  ];

  return {
    subject: `We received the ${companyName} logo submission`,
    preview,
    html: renderShell({
      preview,
      eyebrow: "Submission received",
      title: "The official logo submission is under review.",
      body,
      details,
      note: "The submitter's email address remains private and is used only for this review."
    }),
    text: withTextFooter([
      "SUBMISSION RECEIVED",
      "",
      "The official logo submission is under review.",
      "",
      ...body,
      "",
      formatDetails(details)
    ].join("\n"))
  };
}

export function renderMaintainerCompanySubmissionEmail(
  input: CompanySubmissionEmailInput
): EmailTemplate {
  const companyName = normalizeSubject(input.companyName);
  const preview = `Official artwork for ${companyName} is ready for review.`;
  const details: Detail[] = [
    { label: "Company", value: companyName },
    { label: "Category", value: input.category },
    { label: "Official website", value: input.officialWebsite },
    { label: "Submitter", value: `${input.workEmail}${input.submitterRole ? ` / ${input.submitterRole}` : ""}` },
    { label: "Logo file", value: `${input.logoFormat} / ${input.logoAssetUrl || "No link provided"}` },
    { label: "Brand guidelines", value: input.brandGuidelinesUrl || "Not provided" },
    { label: "Notes", value: input.notes || "None" },
    { label: "Submission ID", value: input.submissionId }
  ];

  return {
    subject: `Company logo submission: ${companyName}`,
    preview,
    html: renderShell({
      preview,
      eyebrow: "Official artwork",
      title: "A company logo submission is ready to review.",
      body: ["A company representative submitted official artwork for source, format, and brand-guideline review."],
      details,
      action: { label: "Reply to submitter", url: `mailto:${input.workEmail}` },
      note: "Keep the work email private when creating catalog records or public GitHub issues."
    }),
    text: withTextFooter([
      "OFFICIAL ARTWORK",
      "",
      "A company logo submission is ready to review.",
      "",
      formatDetails(details)
    ].join("\n"))
  };
}
