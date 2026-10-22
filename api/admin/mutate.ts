import { dashboardMutation } from "../_lib/admin-dashboard.js";
import { prepareResourceMutation } from "../_lib/admin-resource-mutations.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError } from "zod";
import { requireAdmin } from "../_lib/auth.js";
import { buildMutationChanges, catalogPaths, mutationSchema } from "../_lib/catalog.js";
import { createCatalogPullRequest, readRepositoryFile, readRepositoryJson } from "../_lib/github.js";
import { jsonError, methodNotAllowed, requireSameOrigin } from "../_lib/http.js";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (!requireSameOrigin(request, response)) return;
  const admin = requireAdmin(request, response);
  if (!admin) return;
  try {
    if (typeof request.query.view === "string") {
      if (["plugin", "report-triage"].includes(request.query.view)) { response.status(200).json(await dashboardMutation(request.query.view, request.body, admin.login)); return; }
      if (request.query.view !== "resource") throw new Error("Unknown mutation view");
      const prepared = await prepareResourceMutation(request.body, admin.login, admin.githubToken);
      const pr = await createCatalogPullRequest({...prepared, sessionToken:admin.githubToken});
      response.status(201).json(pr.local ? {localPreview:true} : {pullRequest:{number:pr.number,url:pr.html_url},status:"pending-review"}); return;
    }
    const mutation = mutationSchema.parse(request.body);
    const [catalog, variations, manifest] = await Promise.all([
      readRepositoryJson(catalogPaths.catalog, admin.githubToken),
      readRepositoryJson(catalogPaths.variations, admin.githubToken),
      readRepositoryJson<{ version: number; render_settings: unknown; source_sha256: Record<string, string> }>(
        catalogPaths.manifest,
        admin.githubToken
      )
    ]);
    let currentPrimarySource: Buffer | undefined;
    if (mutation.operation === "replace-logo") {
      const entry = (catalog as Array<{ slug?: unknown; source_path?: unknown }>).find((item) => item.slug === mutation.slug);
      if (!entry || typeof entry.source_path !== "string") throw new Error(`Logo "${mutation.slug}" does not exist`);
      if (!/^sources\/[a-z0-9-]+\.svg$/.test(entry.source_path)) throw new Error("Only managed SVG source files can be versioned");
      const source = await readRepositoryFile(`packages/logos/src/${entry.source_path}`, admin.githubToken);
      if (!source) throw new Error("The current primary SVG could not be loaded");
      currentPrimarySource = source;
    }
    const prepared = await buildMutationChanges(mutation, catalog, variations, manifest, { currentPrimarySource });
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
    jsonError(response, error, error instanceof Error && /already|not found|does not|Only logos|Confirmation|uploaded|SVG|primary|official source/.test(error.message) ? 400 : 500);
  }
}
