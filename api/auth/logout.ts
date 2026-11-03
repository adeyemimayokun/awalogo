import type { VercelRequest, VercelResponse } from "../_lib/vercel-types";
import { clearSession } from "../_lib/auth.js";
import { methodNotAllowed, requireSameOrigin } from "../_lib/http.js";

export default function handler(request: VercelRequest, response: VercelResponse): void {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (!requireSameOrigin(request, response)) return;
  clearSession(response);
  response.status(200).json({ ok: true });
}
