import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError } from "zod";
import { sendPrivateLogoRequest } from "./_lib/email.js";
import { createRepositoryIssue, listRepositoryIssues } from "./_lib/github.js";
import { methodNotAllowed, requireSameOrigin } from "./_lib/http.js";
import { buildPublicIssue, publicLogoRequestSchema } from "./_lib/logo-requests.js";
import {
  appendPrivateRequestMetadata,
  readPrivateRequestMetadata,
  readSubmissionId
} from "./_lib/request-metadata.js";

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (!requireSameOrigin(request, response)) return;

  try {
    const submission = publicLogoRequestSchema.parse(request.body);
    let emailDelivered = false;
    try {
      await sendPrivateLogoRequest(submission);
      emailDelivered = true;
    } catch (error) {
      console.error("Logo request maintainer email delivery failed", error);
    }

    let existingIssue = null;
    try {
      existingIssue = (await listRepositoryIssues("logo-request"))
        .find((item) => readSubmissionId(item.body) === submission.submissionId) ?? null;
    } catch (error) {
      console.error("Logo request duplicate check failed", error);
    }

    let createdIssue = existingIssue;
    let metadataStored = existingIssue ? readPrivateRequestMetadata(existingIssue.body) !== null : false;
    if (!createdIssue) {
      const publicIssue = buildPublicIssue(submission);
      let issueBody = publicIssue.body;
      let metadataPrepared = false;
      try {
        issueBody = appendPrivateRequestMetadata(publicIssue.body, {
          submissionId: submission.submissionId,
          email: submission.email,
          logoAssetUrl: submission.logoAssetUrl,
          notifyWhenAvailable: submission.notifyWhenAvailable
        });
        metadataPrepared = true;
      } catch (error) {
        console.error("Logo request encrypted metadata storage is unavailable", error);
      }

      if (metadataPrepared || emailDelivered) {
        try {
          createdIssue = await createRepositoryIssue({
            ...publicIssue,
            body: issueBody,
            labels: ["logo-request"]
          });
          metadataStored = metadataPrepared;
        } catch (error) {
          console.error("Logo request public issue creation failed", error);
        }
      }
    }

    if (!emailDelivered && !metadataStored) {
      response.status(503).json({
        error: "We could not securely save your request right now. Please wait a moment and try again."
      });
      return;
    }

    response.status(existingIssue ? 200 : createdIssue ? 201 : 202).json({
      ok: true,
      issue: createdIssue ? { number: createdIssue.number, url: createdIssue.html_url } : null,
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
