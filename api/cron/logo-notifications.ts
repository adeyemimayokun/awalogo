import type { VercelRequest, VercelResponse } from "@vercel/node";
import { liveLogoCatalog } from "../_lib/live-catalog.js";
import { dispatchLogoNotifications } from "../_lib/logo-notification-queue.js";
import { methodNotAllowed } from "../_lib/http.js";
import { resendAudience } from "../_lib/resend-audience.js";

export const config = { maxDuration: 60 };

function authorized(request: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(
    secret &&
    request.headers.authorization === `Bearer ${secret}`
  );
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
  if (!authorized(request)) {
    response.status(401).json({ error: "Cron authorization required" });
    return;
  }
  response.setHeader("Cache-Control", "no-store");

  try {
    const result = await dispatchLogoNotifications(
      resendAudience,
      liveLogoCatalog
    );
    response.status(200).json({ ok: true, result });
  } catch (error) {
    console.error("Automatic logo notification run failed", error);
    response.status(503).json({
      error: "The automatic logo notification run failed"
    });
  }
}
