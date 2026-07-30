import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError } from "zod";
import { requireAdmin } from "../_lib/auth.js";
import { sendLogoLiveNotification } from "../_lib/email.js";
import {
  logoLiveNotificationKey,
  logoLiveNotificationSchema
} from "../_lib/logo-notifications.js";
import { jsonError, methodNotAllowed, requireSameOrigin } from "../_lib/http.js";

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (!requireSameOrigin(request, response)) return;
  if (!requireAdmin(request, response)) return;

  try {
    const notification = logoLiveNotificationSchema.parse(request.body);
    await sendLogoLiveNotification(
      notification.recipientEmail,
      {
        institutionName: notification.institutionName,
        logoUrl: notification.logoUrl,
        submissionId: notification.submissionId || undefined
      },
      logoLiveNotificationKey(notification)
    );
    response.status(200).json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: error.issues[0]?.message ?? "Check the notification details." });
      return;
    }
    jsonError(response, error, 503);
  }
}
