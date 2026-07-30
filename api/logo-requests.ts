import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError } from "zod";
import { sendPrivateLogoRequest } from "./_lib/email.js";
import { createRepositoryIssue } from "./_lib/github.js";
import { methodNotAllowed, requireSameOrigin } from "./_lib/http.js";
import { buildPublicIssue, publicLogoRequestSchema } from "./_lib/logo-requests.js";

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (!requireSameOrigin(request, response)) return;

  try {
    const submission = publicLogoRequestSchema.parse(request.body);
    await sendPrivateLogoRequest(submission);

    let issue: { number: number; url: string } | null = null;
    try {
      const publicIssue = buildPublicIssue(submission);
      const createdIssue = await createRepositoryIssue({
        ...publicIssue,
        labels: ["logo-request"]
      });
      issue = { number: createdIssue.number, url: createdIssue.html_url };
    } catch (error) {
      console.error("Logo request was emailed but public issue creation failed", error);
    }

    response.status(201).json({ ok: true, issue });
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: error.issues[0]?.message ?? "Check the form and try again." });
      return;
    }
    console.error("Logo request submission failed", error);
    response.status(503).json({
      error: "We could not send your request right now. Please wait a moment and try again."
    });
  }
}
