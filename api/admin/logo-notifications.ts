import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z, ZodError } from "zod";
import { requireAdmin } from "../_lib/auth.js";
import { liveLogoCatalog } from "../_lib/live-catalog.js";
import {
  dispatchLogoNotifications,
  getNotificationQueue
} from "../_lib/logo-notification-queue.js";
import { jsonError, methodNotAllowed, requireSameOrigin } from "../_lib/http.js";
import { resendAudience } from "../_lib/resend-audience.js";

const dispatchSchema = z.object({
  segmentId: z.string().uuid().optional(),
  logoSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional()
}).refine(
  (value) => Boolean(value.segmentId) === Boolean(value.logoSlug),
  "A manual dispatch requires both a request and a logo"
);

export const config = { maxDuration: 60 };

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  if (!["GET", "POST"].includes(request.method ?? "")) {
    return methodNotAllowed(response, ["GET", "POST"]);
  }
  if (request.method === "POST" && !requireSameOrigin(request, response)) return;
  if (!requireAdmin(request, response)) return;
  response.setHeader("Cache-Control", "no-store");

  try {
    if (request.method === "GET") {
      const queue = await getNotificationQueue(resendAudience, liveLogoCatalog);
      response.status(200).json({
        queue,
        summary: {
          total: queue.length,
          ready: queue.filter((item) => item.status === "ready").length,
          ambiguous: queue.filter((item) => item.status === "ambiguous").length,
          unmatched: queue.filter((item) => item.status === "unmatched").length
        }
      });
      return;
    }

    const input = dispatchSchema.parse(request.body ?? {});
    const result = await dispatchLogoNotifications(
      resendAudience,
      liveLogoCatalog,
      input
    );
    response.status(200).json({ ok: true, result });
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: error.issues[0]?.message ?? "Check the notification request."
      });
      return;
    }
    jsonError(response, error, 503);
  }
}
