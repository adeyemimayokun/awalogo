import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError } from "zod";
import { sendPrivateLogoRequest } from "./_lib/email.js";
import { createRepositoryIssue, listRepositoryIssues } from "./_lib/github.js";
import { methodNotAllowed, requireSameOrigin } from "./_lib/http.js";
import { buildPublicIssue, publicLogoRequestSchema } from "./_lib/logo-requests.js";
import {
  appendPrivateRequestMetadata,
  readSubmissionId
} from "./_lib/request-metadata.js";

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (!requireSameOrigin(request, response)) return;

  try {
    const submission = publicLogoRequestSchema.parse(request.body);
    const existingIssue = (await listRepositoryIssues("logo-request"))
      .find((item) => readSubmissionId(item.body) === submission.submissionId);
    let createdIssue = existingIssue;
    if (!createdIssue) {
      const publicIssue = buildPublicIssue(submission);
      createdIssue = await createRepositoryIssue({
        ...publicIssue,
        body: appendPrivateRequestMetadata(publicIssue.body, {
          submissionId: submission.submissionId,
          email: submission.email,
          logoAssetUrl: submission.logoAssetUrl,
          notifyWhenAvailable: submission.notifyWhenAvailable
        }),
        labels: ["logo-request"]
      });
    }

    let emailDelivered = true;
    try {
      await sendPrivateLogoRequest(submission);
    } catch (error) {
      emailDelivered = false;
      console.error("Logo request was stored but maintainer email delivery failed", error);
    }

    response.status(existingIssue ? 200 : 201).json({
      ok: true,
      issue: { number: createdIssue.number, url: createdIssue.html_url },
      emailDelivered
    });
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: error.issues[0]?.message ?? "Check the form and try again." });
      return;
    }
    console.error("Logo request persistence failed", error);
    response.status(503).json({
      error: "We could not securely save your request right now. Please wait a moment and try again."
    });
  }
}
