import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin } from "../_lib/auth.js";
import { isLocalRepositoryMode, readRepositoryFile } from "../_lib/github.js";
import { jsonError, methodNotAllowed } from "../_lib/http.js";

const assetPath = /^packages\/logos\/src\/assets\/[a-z0-9-]+\.(?:svg|png|webp|jpg)$/;
const mimeTypes: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg"
};

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
  if (!isLocalRepositoryMode() || !requireAdmin(request, response)) return;

  const path = typeof request.query.path === "string" ? request.query.path : "";
  if (!assetPath.test(path)) {
    response.status(400).json({ error: "Invalid local asset path" });
    return;
  }

  try {
    const asset = await readRepositoryFile(path);
    if (!asset) {
      response.status(404).json({ error: "Local asset not found" });
      return;
    }
    const extension = path.split(".").pop() ?? "";
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", mimeTypes[extension] ?? "application/octet-stream");
    response.status(200).end(asset);
  } catch (error) {
    jsonError(response, error, 404);
  }
}
