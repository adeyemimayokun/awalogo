import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError } from "zod";
import { requireAdmin } from "../_lib/auth.js";
import { createCatalogPullRequest, isLocalRepositoryMode, readRepositoryJson } from "../_lib/github.js";
import { jsonError, methodNotAllowed, requireSameOrigin } from "../_lib/http.js";
import {
  applySiteUpdateMutation,
  siteUpdateMutationSchema,
  siteUpdatesSchema,
  type SiteUpdate
} from "../_lib/site-updates.js";

const updatesPath = "packages/catalog-ui/src/site-updates.json";

function prettyJson(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET" && request.method !== "POST") return methodNotAllowed(response, ["GET", "POST"]);
  if (request.method === "POST" && !requireSameOrigin(request, response)) return;
  const admin = requireAdmin(request, response);
  if (!admin) return;
  response.setHeader("Cache-Control", "no-store");

  try {
    const current = siteUpdatesSchema.parse(await readRepositoryJson<SiteUpdate[]>(updatesPath, admin.githubToken));
    if (request.method === "GET") {
      response.status(200).json({ updates: current, localPreview: isLocalRepositoryMode() });
      return;
    }

    const mutation = siteUpdateMutationSchema.parse(request.body);
    const updates = applySiteUpdateMutation(current, mutation);
    const action = mutation.operation === "create" ? "Publish" : mutation.operation === "update" ? "Edit" : "Remove";
    const pullRequest = await createCatalogPullRequest({
      action: `site-update-${mutation.operation}`,
      slug: mutation.id,
      title: `CMS: ${action} website update ${mutation.id}`,
      body: [
        "Created by the secured awalogo CMS.",
        "",
        `- Operation: \`${mutation.operation}\``,
        `- Update: \`${mutation.id}\``,
        mutation.operation === "delete" ? "- Result: removed from the website update feed" : `- Visibility: \`${mutation.status}\``,
        "",
        "Please review the public copy and destination before merging."
      ].join("\n"),
      changes: [{ path: updatesPath, content: prettyJson(updates) }],
      sessionToken: admin.githubToken
    });

    response.status(201).json({
      ok: true,
      updates,
      localPreview: pullRequest.local === true,
      pullRequest: pullRequest.local ? undefined : { number: pullRequest.number, url: pullRequest.html_url }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: error.issues[0]?.message ?? "Invalid website update" });
      return;
    }
    jsonError(response, error, error instanceof Error && /already exists|not found|Confirmation|Action link/.test(error.message) ? 400 : 500);
  }
}
