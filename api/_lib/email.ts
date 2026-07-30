import type { PublicLogoRequest } from "./logo-requests.js";
import {
  renderCompanySubmissionReceivedEmail,
  renderLogoLiveEmail,
  renderLogoRequestReceivedEmail,
  renderMaintainerCompanySubmissionEmail,
  renderMaintainerLogoRequestEmail,
  type CompanySubmissionEmailInput,
  type EmailTemplate,
  type LogoLiveEmailInput
} from "./email-templates.js";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function sendPrivateLogoRequest(request: PublicLogoRequest): Promise<void> {
  await sendEmail({
    to: requiredEnv("LOGO_REQUEST_INBOX"),
    replyTo: request.email,
    template: renderMaintainerLogoRequestEmail(request),
    idempotencyKey: `logo-request-maintainer-${request.submissionId}`
  });
}

export async function sendLogoRequestReceipt(
  request: PublicLogoRequest,
  issueUrl?: string
): Promise<void> {
  await sendEmail({
    to: request.email,
    replyTo: requiredEnv("LOGO_REQUEST_INBOX"),
    template: renderLogoRequestReceivedEmail(request, issueUrl),
    idempotencyKey: `logo-request-received-${request.submissionId}`
  });
}

export async function sendLogoLiveNotification(
  recipientEmail: string,
  input: LogoLiveEmailInput,
  idempotencyKey: string
): Promise<void> {
  await sendEmail({
    to: recipientEmail,
    replyTo: requiredEnv("LOGO_REQUEST_INBOX"),
    template: renderLogoLiveEmail(input),
    idempotencyKey
  });
}

export async function sendPrivateCompanySubmission(
  submission: CompanySubmissionEmailInput
): Promise<void> {
  await sendEmail({
    to: requiredEnv("LOGO_REQUEST_INBOX"),
    replyTo: submission.workEmail,
    template: renderMaintainerCompanySubmissionEmail(submission),
    idempotencyKey: `company-submission-maintainer-${submission.submissionId}`
  });
}

export async function sendCompanySubmissionReceipt(
  submission: CompanySubmissionEmailInput
): Promise<void> {
  await sendEmail({
    to: submission.workEmail,
    replyTo: requiredEnv("LOGO_REQUEST_INBOX"),
    template: renderCompanySubmissionReceivedEmail(submission),
    idempotencyKey: `company-submission-received-${submission.submissionId}`
  });
}

async function sendEmail(options: {
  to: string;
  replyTo: string;
  template: EmailTemplate;
  idempotencyKey: string;
}): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
      "User-Agent": "awalogo/1.0 (+https://awalogo.com)",
      "Idempotency-Key": options.idempotencyKey
    },
    body: JSON.stringify({
      from: requiredEnv("LOGO_REQUEST_FROM_EMAIL"),
      to: [options.to],
      reply_to: options.replyTo,
      subject: options.template.subject,
      html: options.template.html,
      text: options.template.text
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email delivery failed (${response.status}): ${detail.slice(0, 240)}`);
  }
}
