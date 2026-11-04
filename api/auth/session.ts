import type { VercelRequest, VercelResponse } from "../_lib/vercel-types";
import { requireAdmin } from "../_lib/auth.js";
import { methodNotAllowed } from "../_lib/http.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
  response.setHeader("Cache-Control", "no-store");
  const session = await requireAdmin(request, response);
  if (!session) return;
  response.status(200).json({
    authenticated: true,
    user: {
      login: session.login,
      avatarUrl: session.avatarUrl,
      local: session.local ?? false,
      repositoryAccess: Boolean(session.local || session.githubToken)
    }
  });
}
