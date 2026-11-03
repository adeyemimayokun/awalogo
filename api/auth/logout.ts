import type { VercelRequest, VercelResponse } from "../_lib/vercel-types";
import { logoutSession } from "../_lib/auth.js";
import { methodNotAllowed, requireSameOrigin } from "../_lib/http.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (!requireSameOrigin(request, response)) return;
  response.setHeader("Cache-Control", "no-store");
  try {
    await logoutSession(request, response);
    response.status(200).json({ ok: true });
  } catch {
    // Do not report success until a copied cookie is also revoked.
    response.status(503).json({ error: "Sign out unavailable. Please try again." });
  }
}
