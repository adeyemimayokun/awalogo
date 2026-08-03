import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError } from "zod";
import { requireAdmin } from "../_lib/auth.js";
import { buildMutationChanges, catalogPaths, mutationSchema } from "../_lib/catalog.js";
import { createCatalogPullRequest, readRepositoryJson } from "../_lib/github.js";
import { jsonError, methodNotAllowed, requireSameOrigin } from "../_lib/http.js";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (!requireSameOrigin(request, response)) return;
  const admin = requireAdmin(request, response);
  if (!admin) return;
  try {
    const mutation = mutationSchema.parse(request.body);
    const [catalog, variations, manifest] = await Promise.all([
      readRepositoryJson(catalogPaths.catalog, admin.githubToken),
      readRepositoryJson(catalogPaths.variations, admin.githubToken),
      readRepositoryJson<{ version: number; render_settings: unknown; source_sha256: Record<string, string> }>(
        catalogPaths.manifest,
        admin.githubToken
      )
    ]);
    const prepared = await buildMutationChanges(mutation, catalog, variations, manifest);
    const pullRequest = await createCatalogPullRequest({
      action: mutation.operation,
      slug: mutation.slug,
      title: prepared.title,
      body: `${prepared.body}\n\nSubmitted by @${admin.login}.`,
      changes: prepared.changes,
      sessionToken: admin.githubToken
    });
    if (pullRequest.local) {
      response.status(201).json({ ok: true, localPreview: true });
      return;
    }
    response.status(201).json({ ok: true, pullRequest: { number: pullRequest.number, url: pullRequest.html_url } });
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: error.issues[0]?.message ?? "Invalid request" });
      return;
    }
    if (error instanceof Error && /GitHub request failed \(403\)|repository access is not connected/i.test(error.message)) {
      response.status(403).json({
        error: "GitHub cannot write this catalog change. Reconnect GitHub from the admin banner and approve repository access."
      });
      return;
    }
    jsonError(response, error, error instanceof Error && /already exists|not found|does not|Confirmation|uploaded|SVG/.test(error.message) ? 400 : 500);
  }
}
