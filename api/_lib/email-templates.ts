import type { PublicLogoRequest } from "./logo-requests.js";

export type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function emailLayout(options: {
  eyebrow: string;
  heading: string;
  intro: string;
  content: string;
  footer: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;background:#f3f4ef;color:#292a27;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4ef;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dcdfd5;">
          <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #e4e6df;">
            <div style="font-size:21px;font-weight:700;letter-spacing:0;color:#292a27;">awalogo</div>
          </td></tr>
          <tr><td style="padding:30px 32px 12px;">
            <div style="margin-bottom:10px;color:#607326;font-size:12px;font-weight:700;text-transform:uppercase;">${escapeHtml(options.eyebrow)}</div>
            <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:#292a27;">${escapeHtml(options.heading)}</h1>
            <p style="margin:0;color:#696b66;font-size:15px;line-height:1.6;">${escapeHtml(options.intro)}</p>
          </td></tr>
          <tr><td style="padding:12px 32px 30px;">${options.content}</td></tr>
          <tr><td style="padding:20px 32px;background:#f8f9f5;border-top:1px solid #e4e6df;color:#777a73;font-size:12px;line-height:1.55;">
            ${escapeHtml(options.footer)}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function detailRows(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #e4e6df;">${rows.map(([label, value]) => `
    <tr>
      <td style="padding:12px 8px 12px 0;border-bottom:1px solid #e4e6df;color:#777a73;font-size:13px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:12px 0 12px 8px;border-bottom:1px solid #e4e6df;color:#292a27;font-size:14px;font-weight:600;text-align:right;word-break:break-word;">${escapeHtml(value)}</td>
    </tr>`).join("")}
  </table>`;
}

export function maintainerLogoRequestTemplate(request: PublicLogoRequest): EmailTemplate {
  const subject = `Logo request: ${cleanSubject(request.institutionName)}`;
  const rows: Array<[string, string]> = [
    ["Company or product", request.institutionName],
    ["Type of company", request.category],
    ["Company website", request.officialWebsite],
    ["Contributor email", request.email],
    ["Logo file link", request.logoAssetUrl || "Not provided"],
    ["Notify when available", request.notifyWhenAvailable ? "Yes" : "No"],
    ["Submission ID", request.submissionId]
  ];
  const text = [
    "A new logo request was submitted through awalogo.com.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`)
  ].join("\n");

  return {
    subject,
    text,
    html: emailLayout({
      eyebrow: "New catalog request",
      heading: request.institutionName,
      intro: "A visitor submitted a new logo request through awalogo.com.",
      content: detailRows(rows),
      footer: "This message contains private request details and was sent only to the awalogo maintainers."
    })
  };
}

export function requesterLogoRequestTemplate(request: PublicLogoRequest): EmailTemplate {
  const subject = `We received your ${cleanSubject(request.institutionName)} logo request`;
  const rows: Array<[string, string]> = [
    ["Company or product", request.institutionName],
    ["Type of company", request.category],
    ["Company website", request.officialWebsite],
    ["Submission ID", request.submissionId]
  ];
  const text = [
    "Thanks for helping awalogo grow.",
    "",
    `We received your request for ${request.institutionName}. Our maintainers will review the company and its official logo source before publishing it.`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    request.notifyWhenAvailable
      ? "You asked us to email you when this logo becomes available."
      : "You did not request an availability email."
  ].join("\n");

  return {
    subject,
    text,
    html: emailLayout({
      eyebrow: "Request received",
      heading: "Thanks for helping awalogo grow",
      intro: `We received your request for ${request.institutionName}. Our maintainers will review its official source before publishing it.`,
      content: detailRows(rows),
      footer: request.notifyWhenAvailable
        ? "You asked us to email you when this logo becomes available."
        : "You did not request an availability email."
    })
  };
}
