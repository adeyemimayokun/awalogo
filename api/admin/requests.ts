import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { requireAdmin } from "../_lib/auth.js";
import {
  isLocalRepositoryMode,
  listRepositoryIssues,
  type RepositoryIssue,
  updateRepositoryIssue
} from "../_lib/github.js";
import { jsonError, methodNotAllowed } from "../_lib/http.js";

const requestStatuses = ["pending", "in-review", "needs-info", "approved", "completed", "rejected"] as const;
type RequestStatus = typeof requestStatuses[number];

const statusLabels: Record<Exclude<RequestStatus, "pending">, string> = {
  "in-review": "request-in-review",
  "needs-info": "request-needs-info",
  approved: "request-approved",
  completed: "request-completed",
  rejected: "request-rejected"
};
const managedStatusLabels = new Set(Object.values(statusLabels));
const updateSchema = z.object({
  number: z.number().int().positive(),
  status: z.enum(requestStatuses)
});

function issueStatus(issue: RepositoryIssue): RequestStatus {
  const labels = new Set(issue.labels.map((label) => label.name));
  for (const [status, label] of Object.entries(statusLabels) as Array<[Exclude<RequestStatus, "pending">, string]>) {
    if (labels.has(label)) return status;
  }
  return issue.state === "closed" ? "completed" : "pending";
}

function issueSection(body: string | null, heading: string): string {
  if (!body) return "";
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body.match(new RegExp(`## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n---|$)`, "i"))?.[1]?.trim() ?? "";
}

function cleanAssetUrl(value: string): string | null {
  const cleaned = value.replace(/^-\s*Public drive link:\s*/i, "").trim();
  return !cleaned || cleaned === "Not provided" ? null : cleaned;
}

function serializeIssue(issue: RepositoryIssue) {
  const institution = issueSection(issue.body, "Institution") || issue.title.replace(/^Logo request:\s*/i, "");
  return {
    number: issue.number,
    institution,
    category: issueSection(issue.body, "Category") || "Other",
    website: issueSection(issue.body, "Official website") || null,
    assetUrl: cleanAssetUrl(issueSection(issue.body, "Submitted logo artwork")),
    notifyWhenAvailable: issueSection(issue.body, "Availability notification").startsWith("Requested"),
    status: issueStatus(issue),
    state: issue.state,
    submittedAt: issue.created_at,
    updatedAt: issue.updated_at,
    submitter: issue.user?.login ?? "unknown",
    issueUrl: issue.html_url
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET" && request.method !== "PATCH") return methodNotAllowed(response, ["GET", "PATCH"]);
  if (!requireAdmin(request, response)) return;

  try {
    const issues = await listRepositoryIssues("logo-request");
    if (request.method === "GET") {
      response.status(200).json({
        requests: issues.map(serializeIssue),
        localPreview: isLocalRepositoryMode()
      });
      return;
    }

    const update = updateSchema.parse(request.body);
    const current = issues.find((issue) => issue.number === update.number);
    if (!current) {
      response.status(404).json({ error: `Logo request #${update.number} was not found` });
      return;
    }
    const labels = current.labels
      .map((label) => label.name)
      .filter((label) => !managedStatusLabels.has(label));
    if (update.status !== "pending") labels.push(statusLabels[update.status]);
    const updated = await updateRepositoryIssue({
      number: update.number,
      labels,
      state: update.status === "completed" || update.status === "rejected" ? "closed" : "open"
    });
    response.status(200).json({ request: serializeIssue(updated), localPreview: isLocalRepositoryMode() });
  } catch (error) {
    jsonError(response, error);
  }
}
