import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError } from "zod";
import { requireAdmin } from "../_lib/auth.js";
import { applyChangelogMutation, changelogMutationSchema, changelogSchema, type ChangelogRelease } from "../_lib/changelog.js";
import { createCatalogPullRequest, isLocalRepositoryMode, readRepositoryJson } from "../_lib/github.js";
import { jsonError, methodNotAllowed, requireSameOrigin } from "../_lib/http.js";

const changelogPath = "packages/catalog-ui/src/changelog.json";

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
    const current = changelogSchema.parse(await readRepositoryJson<ChangelogRelease[]>(changelogPath, admin.githubToken));
    if (request.method === "GET") {
      response.status(200).json({ releases: current, localPreview: isLocalRepositoryMode() });
      return;
    }

    const mutation = changelogMutationSchema.parse(request.body);
    const releases = applyChangelogMutation(current, mutation);
    const action = mutation.operation === "create" ? "Publish" : mutation.operation === "update" ? "Edit" : "Remove";
    const pullRequest = await createCatalogPullRequest({
      action: `changelog-${mutation.operation}`,
      slug: mutation.version.replaceAll(".", "-"),
      title: `CMS: ${action} changelog release ${mutation.version}`,
      body: [
        "Created by the secured awalogo CMS.",
        "",
        `- Operation: \`${mutation.operation}\``,
        `- Release: \`${mutation.version}\``,
        mutation.operation === "delete" ? "- Result: removed from the changelog" : `- Visibility: \`${mutation.status}\``,
        "",
        "Please review the release title, date, visibility, and notes before merging."
      ].join("\n"),
      changes: [{ path: changelogPath, content: prettyJson(releases) }],
      sessionToken: admin.githubToken
    });

    response.status(201).json({
      ok: true,
      releases,
      localPreview: pullRequest.local === true,
      pullRequest: pullRequest.local ? undefined : { number: pullRequest.number, url: pullRequest.html_url }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: error.issues[0]?.message ?? "Invalid changelog release" });
      return;
    }
    jsonError(response, error, error instanceof Error && /already exists|not found|Confirmation/.test(error.message) ? 400 : 500);
  }
}
