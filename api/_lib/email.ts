import type { PublicLogoRequest } from "./logo-requests.js";
import { buildMaintainerEmail } from "./logo-requests.js";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function sendPrivateLogoRequest(request: PublicLogoRequest): Promise<void> {
  const message = buildMaintainerEmail(request);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `logo-request-${request.submissionId}`
    },
    body: JSON.stringify({
      from: requiredEnv("LOGO_REQUEST_FROM_EMAIL"),
      to: [requiredEnv("LOGO_REQUEST_INBOX")],
      reply_to: request.email,
      subject: message.subject,
      text: message.text
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Private request email failed (${response.status}): ${detail.slice(0, 240)}`);
  }
}
