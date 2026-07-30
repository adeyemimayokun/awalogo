import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError } from "zod";
import {
  sendCompanySubmissionReceipt,
  sendPrivateCompanySubmission
} from "./_lib/email.js";
import {
  buildPublicCompanySubmissionIssue,
  companyLogoSubmissionSchema
} from "./_lib/company-submissions.js";
import { createRepositoryIssue } from "./_lib/github.js";
import { methodNotAllowed, requireSameOrigin } from "./_lib/http.js";

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (!requireSameOrigin(request, response)) return;

  try {
    const submission = companyLogoSubmissionSchema.parse(request.body);
    await sendPrivateCompanySubmission(submission);
    await sendCompanySubmissionReceipt(submission);

    let issue: { number: number; url: string } | null = null;
    try {
      const publicIssue = buildPublicCompanySubmissionIssue(submission);
      const createdIssue = await createRepositoryIssue({
        ...publicIssue,
        labels: ["logo-request"]
      });
      issue = { number: createdIssue.number, url: createdIssue.html_url };
    } catch (error) {
      console.error("Company submission was emailed but public issue creation failed", error);
    }

    response.status(201).json({ ok: true, issue });
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: error.issues[0]?.message ?? "Check the form and try again." });
      return;
    }
    console.error("Company logo submission failed", error);
    response.status(503).json({
      error: "We could not send the logo submission right now. Please wait a moment and try again."
    });
  }
}
