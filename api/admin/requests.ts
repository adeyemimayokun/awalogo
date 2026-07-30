import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z, ZodError } from "zod";
import {
  issueLabelNames,
  labelsForStatus,
  parseAdminRequest,
  requestStatusOptions,
  requestStatusSchema,
  statusLabel,
  summarizeAdminRequests
} from "../_lib/admin-requests.js";
import { requireAdmin } from "../_lib/auth.js";
import {
  ensureRepositoryLabel,
  listRepositoryIssues,
  readRepositoryIssue,
  updateRepositoryIssue
} from "../_lib/github.js";
import { jsonError, methodNotAllowed, requireSameOrigin } from "../_lib/http.js";

const updateSchema = z.object({
  issueNumber: z.number().int().positive(),
  status: requestStatusSchema
});

function noStore(response: VercelResponse): void {
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET" && request.method !== "PATCH") {
    return methodNotAllowed(response, ["GET", "PATCH"]);
  }
  if (!requireAdmin(request, response)) return;
  noStore(response);

  try {
    if (request.method === "GET") {
      const requests = (await listRepositoryIssues())
        .map(parseAdminRequest)
        .filter((item) => item !== null);
      response.status(200).json({ requests, summary: summarizeAdminRequests(requests) });
      return;
    }

    if (!requireSameOrigin(request, response)) return;
    const input = updateSchema.parse(request.body);
    const issue = await readRepositoryIssue(input.issueNumber);
    if (!parseAdminRequest(issue)) {
      response.status(404).json({ error: "This issue is not an awalogo request" });
      return;
    }

    const statusDefinition = requestStatusOptions.find((status) => status.value === input.status)!;
    await ensureRepositoryLabel({
      name: statusLabel(input.status),
      color: statusDefinition.labelColor,
      description: statusDefinition.description
    });

    const closed = input.status === "published" || input.status === "declined";
    const updatedIssue = await updateRepositoryIssue({
      issueNumber: issue.number,
      labels: labelsForStatus(issueLabelNames(issue), input.status),
      state: closed ? "closed" : "open",
      stateReason: input.status === "declined" ? "not_planned" : closed ? "completed" : "reopened"
    });
    const updatedRequest = parseAdminRequest(updatedIssue);
    if (!updatedRequest) throw new Error("GitHub returned an invalid request after the update");
    response.status(200).json({ request: updatedRequest });
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: error.issues[0]?.message ?? "Check the request status and try again" });
      return;
    }
    jsonError(response, error);
  }
}
