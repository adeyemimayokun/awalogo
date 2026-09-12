import type { PublicLogoRequest } from "./logo-requests.js";
import {
  maintainerLogoRequestTemplate,
  requesterLogoRequestTemplate,
  type EmailTemplate
} from "./email-templates.js";

export type DeliveredLogoRequest = {
  id: string;
  submissionId: string;
  institution: string;
  category: string;
  website: string | null;
  email: string | null;
  assetUrl: string | null;
  notifyWhenAvailable: boolean;
  submittedAt: string;
};

type ResendEmailSummary = {
  id: string;
  subject: string;
  created_at: string;
};

type ResendEmail = ResendEmailSummary & {
  text?: string | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function resend<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}` }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend request failed (${response.status}): ${detail.slice(0, 240)}`);
  }
  return response.json() as Promise<T>;
}

function lineValue(text: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`^${escaped}:\\s*(.+)$`, "mi"))?.[1]?.trim() ?? "";
}

function safeHttpUrl(value: string): string | null {
  if (!value || /^not provided$/i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function deliveredLogoRequest(email: ResendEmail): DeliveredLogoRequest | null {
  if (!email.text || !email.subject.startsWith("Logo request:")) return null;
  const submissionId = lineValue(email.text, "Submission ID");
  const institution = lineValue(email.text, "Company or product") || email.subject.replace(/^Logo request:\s*/i, "");
  if (!submissionId || !institution) return null;
  const contributorEmail = lineValue(email.text, "Contributor email");
  return {
    id: email.id,
    submissionId,
    institution,
    category: lineValue(email.text, "Type of company") || "Other",
    website: safeHttpUrl(lineValue(email.text, "Company website")),
    email: contributorEmail || null,
    assetUrl: safeHttpUrl(lineValue(email.text, "Logo file link")),
    notifyWhenAvailable: /^yes$/i.test(lineValue(email.text, "Notify when available")),
    submittedAt: email.created_at
  };
}

export async function listDeliveredLogoRequests(): Promise<DeliveredLogoRequest[]> {
  if (!process.env.RESEND_API_KEY?.trim()) return [];
  const list = await resend<{ data?: ResendEmailSummary[] }>("/emails?limit=20");
  const candidates = (list.data ?? [])
    .filter((email) => email.subject.startsWith("Logo request:"))
    .slice(0, 20);
  const requests: DeliveredLogoRequest[] = [];
  for (const candidate of candidates) {
    const parsed = deliveredLogoRequest(await resend<ResendEmail>(`/emails/${encodeURIComponent(candidate.id)}`));
    if (parsed) requests.push(parsed);
  }
  return requests;
}

async function sendEmail(options: {
  to: string;
  replyTo?: string;
  idempotencyKey: string;
  message: EmailTemplate;
  tags: Array<{ name: string; value: string }>;
}): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": options.idempotencyKey
    },
    body: JSON.stringify({
      from: requiredEnv("LOGO_REQUEST_FROM_EMAIL"),
      to: [options.to],
      ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      subject: options.message.subject,
      text: options.message.text,
      html: options.message.html,
      tags: options.tags
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Private request email failed (${response.status}): ${detail.slice(0, 240)}`);
  }
}

export async function sendPrivateLogoRequest(request: PublicLogoRequest): Promise<void> {
  await sendEmail({
    to: requiredEnv("LOGO_REQUEST_INBOX"),
    replyTo: request.email,
    idempotencyKey: `logo-request-maintainer-${request.submissionId}`,
    message: maintainerLogoRequestTemplate(request),
    tags: [
      { name: "email_type", value: "logo_request" },
      { name: "submission_id", value: request.submissionId }
    ]
  });

  try {
    await sendEmail({
      to: request.email,
      idempotencyKey: `logo-request-receipt-${request.submissionId}`,
      message: requesterLogoRequestTemplate(request),
      tags: [
        { name: "email_type", value: "logo_request_receipt" },
        { name: "submission_id", value: request.submissionId }
      ]
    });
  } catch (error) {
    console.error("Logo request receipt email delivery failed", error);
  }
}
