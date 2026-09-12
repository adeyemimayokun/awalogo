import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { requireAdmin } from "../_lib/auth.js";
import { listDeliveredLogoRequests } from "../_lib/email.js";
import {
  createRepositoryIssue,
  isLocalRepositoryMode,
  listRepositoryIssues,
  type RepositoryIssue,
  updateRepositoryIssue
} from "../_lib/github.js";
import { jsonError, methodNotAllowed } from "../_lib/http.js";
import { buildPublicIssue, publicLogoRequestSchema } from "../_lib/logo-requests.js";
import {
  appendPrivateRequestMetadata,
  readPrivateRequestMetadata,
  readSubmissionId
} from "../_lib/request-metadata.js";

const requestStatuses = ["pending", "in-review", "needs-info", "approved", "completed", "rejected"] as const;
type RequestStatus = typeof requestStatuses[number];

const statusLabels: Record<Exclude<RequestStatus, "pending">, string> = {
  "in-review": "request-in-review",
  "needs-info": "request-needs-info",
  approved: "request-approved",
  completed: "request-completed",
  rejected: "request-rejected"
};
const statusMarker = /(?:\n\n)?<!--\s*awalogo-request-status:\s*(pending|in-review|needs-info|approved|completed|rejected)\s*-->/i;
const updateSchema = z.object({
  number: z.number().int().positive(),
  status: z.enum(requestStatuses)
});
const recoverSchema = z.object({ emailId: z.string().trim().min(1).max(120) });

function issueStatus(issue: RepositoryIssue): RequestStatus {
  const markedStatus = issue.body?.match(statusMarker)?.[1] as RequestStatus | undefined;
  if (markedStatus && requestStatuses.includes(markedStatus)) return markedStatus;
  const labels = new Set(issue.labels.map((label) => label.name));
  for (const [status, label] of Object.entries(statusLabels) as Array<[Exclude<RequestStatus, "pending">, string]>) {
    if (labels.has(label)) return status;
  }
  return issue.state === "closed" ? "completed" : "pending";
}

function bodyWithStatus(body: string | null, status: RequestStatus): string {
  const content = (body ?? "").replace(statusMarker, "").trimEnd();
  return `${content}${content ? "\n\n" : ""}<!-- awalogo-request-status: ${status} -->`;
}

function issueSection(body: string | null, heading: string): string {
  if (!body) return "";
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body.match(new RegExp(`## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n---|$)`, "i"))?.[1]?.trim() ?? "";
}

function cleanAssetUrl(value: string): string | null {
  const cleaned = value.replace(/^-\s*Public drive link:\s*/i, "").trim();
  if (!cleaned || cleaned === "Not provided") return null;
  try {
    const url = new URL(cleaned);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function serializeIssue(issue: RepositoryIssue) {
  const privateMetadata = readPrivateRequestMetadata(issue.body);
  const institution = issueSection(issue.body, "Institution") ||
    issueSection(issue.body, "Company") ||
    issue.title.replace(/^(?:Logo request|Company logo submission):\s*/i, "");
  return {
    id: `github-${issue.number}`,
    submissionId: readSubmissionId(issue.body),
    number: issue.number,
    institution,
    category: issueSection(issue.body, "Category") || "Other",
    website: issueSection(issue.body, "Official website") || null,
    email: privateMetadata?.email ?? (issueSection(issue.body, "Work email") || null),
    assetUrl: privateMetadata?.logoAssetUrl ||
      cleanAssetUrl(issueSection(issue.body, "Submitted logo artwork")) ||
      cleanAssetUrl(issueSection(issue.body, "Official logo or brand-kit URL")),
    notifyWhenAvailable: privateMetadata?.notifyWhenAvailable ??
      issueSection(issue.body, "Availability notification").startsWith("Requested"),
    status: issueStatus(issue),
    state: issue.state,
    submittedAt: issue.created_at,
    updatedAt: issue.updated_at,
    submitter: issue.user?.login ?? "unknown",
    issueUrl: issue.html_url,
    source: "github" as const
  };
}

async function emailBackedRequests() {
  try {
    return (await listDeliveredLogoRequests()).map((item) => ({
      id: `email-${item.id}`,
      submissionId: item.submissionId,
      number: null,
      institution: item.institution,
      category: item.category,
      website: item.website,
      email: item.email,
      assetUrl: item.assetUrl,
      notifyWhenAvailable: item.notifyWhenAvailable,
      status: "pending" as const,
      state: "open" as const,
      submittedAt: item.submittedAt,
      updatedAt: item.submittedAt,
      submitter: "website request",
      issueUrl: null,
      source: "email" as const
    }));
  } catch (error) {
    console.error("Logo request email fallback failed", error);
    return [];
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET" && request.method !== "POST" && request.method !== "PATCH") {
    return methodNotAllowed(response, ["GET", "POST", "PATCH"]);
  }
  const admin = requireAdmin(request, response);
  if (!admin) return;
  response.setHeader("Cache-Control", "no-store");

  try {
    let issues: RepositoryIssue[] = [];
    let githubAvailable = true;
    try {
      issues = await listRepositoryIssues("logo-request", admin.githubToken);
    } catch (error) {
      githubAvailable = false;
      console.error("GitHub logo request listing failed", error);
    }
    if (request.method === "GET") {
      const issueRequests = issues.map(serializeIssue);
      const knownSubmissionIds = new Set(issueRequests.flatMap((item) => item.submissionId ? [item.submissionId] : []));
      const deliveredRequests = (await emailBackedRequests())
        .filter((item) => !knownSubmissionIds.has(item.submissionId));
      const requests = [...issueRequests, ...deliveredRequests]
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
      response.status(200).json({
        requests,
        localPreview: isLocalRepositoryMode(),
        integration: githubAvailable
          ? { available: true }
          : {
              available: false,
              message: requests.length
                ? "GitHub is unavailable. Delivered email requests are shown read-only until repository access is restored."
                : "GitHub logo requests are unavailable. Configure the admin token with read access to repository issues."
            }
      });
      return;
    }

    if (!githubAvailable) throw new Error("GitHub logo requests are unavailable");

    if (request.method === "POST") {
      const recover = recoverSchema.parse(request.body);
      const delivered = (await listDeliveredLogoRequests()).find((item) => item.id === recover.emailId);
      if (!delivered) {
        response.status(404).json({ error: "The delivered logo request could not be found" });
        return;
      }
      const duplicate = issues.find((issue) => readSubmissionId(issue.body) === delivered.submissionId);
      if (duplicate) {
        response.status(200).json({ request: serializeIssue(duplicate), localPreview: isLocalRepositoryMode() });
        return;
      }
      const submission = publicLogoRequestSchema.parse({
        submissionId: delivered.submissionId,
        institutionName: delivered.institution,
        officialWebsite: delivered.website,
        email: delivered.email,
        category: delivered.category,
        logoAssetUrl: delivered.assetUrl ?? "",
        notifyWhenAvailable: delivered.notifyWhenAvailable,
        websiteConfirm: ""
      });
      const publicIssue = buildPublicIssue(submission);
      const created = await createRepositoryIssue({
        ...publicIssue,
        body: appendPrivateRequestMetadata(publicIssue.body, {
          submissionId: submission.submissionId,
          email: submission.email,
          logoAssetUrl: submission.logoAssetUrl,
          notifyWhenAvailable: submission.notifyWhenAvailable
        }),
        labels: ["logo-request"],
        sessionToken: admin.githubToken
      });
      response.status(201).json({ request: serializeIssue(created), localPreview: isLocalRepositoryMode() });
      return;
    }

    const update = updateSchema.parse(request.body);
    const current = issues.find((issue) => issue.number === update.number);
    if (!current) {
      response.status(404).json({ error: `Logo request #${update.number} was not found` });
      return;
    }
    const updated = await updateRepositoryIssue({
      number: update.number,
      body: bodyWithStatus(current.body, update.status),
      state: update.status === "completed" || update.status === "rejected" ? "closed" : "open",
      sessionToken: admin.githubToken
    });
    response.status(200).json({ request: serializeIssue(updated), localPreview: isLocalRepositoryMode() });
  } catch (error) {
    jsonError(response, error, 503);
  }
}
