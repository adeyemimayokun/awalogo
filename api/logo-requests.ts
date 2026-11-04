import { handleProductEvents } from './_lib/product-events.js';
import type { VercelRequest, VercelResponse } from "./_lib/vercel-types";
import { ZodError } from "zod";
import { handlePopularity } from "./_lib/popularity.js";
import { handleLogoReport } from "./_lib/logo-report.js";
import { sendPrivateLogoRequest } from "./_lib/email.js";
import { createRepositoryIssue } from "./_lib/github.js";
import { claimLogoRequest, deployedRequests } from "./_lib/request-abuse.js";
import { methodNotAllowed, requireSameOrigin } from "./_lib/http.js";
import { buildPublicIssue, publicLogoRequestSchema } from "./_lib/logo-requests.js";
import { getAssetRequestStatus, requestStoreConfigured, saveAssetRequest } from "./_lib/request-store.js";
import { previewDeliveryDisabled } from "./_lib/preview-delivery.js";
import { appendPrivateRequestMetadata } from "./_lib/request-metadata.js";

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.query.view === "events") return handleProductEvents(request,response);
  if (request.query.view === "report") return handleLogoReport(request, response);
  if (request.query.view === "popularity") return handlePopularity(request, response);
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "GET") {
    response.setHeader("Cache-Control", "no-store");
    const token = typeof request.query.token === "string" ? request.query.token : "";
    if (!requestStoreConfigured()) { response.status(503).json({ error: "Request tracking is not available yet" }); return; }
    try {
      const status = await getAssetRequestStatus(token);
      response.status(status ? 200 : 404).json(status ?? { error: "Request not found" });
    } catch (error) {
      console.error("Private request tracking lookup failed", error);
      response.status(503).json({ error: "Request tracking is temporarily unavailable" });
    }
    return;
  }
  if (request.method !== "POST") return methodNotAllowed(response, ["GET", "POST"]);
  if (!requireSameOrigin(request, response)) return;

  let activeClaim: Awaited<ReturnType<typeof claimLogoRequest>> | undefined;
  let externalStarted = false;
  try {
    const submission = publicLogoRequestSchema.parse(request.body);
    const claim = await claimLogoRequest(request, submission);
    if (claim.kind === "accepted") activeClaim = claim;
    if (claim.kind === "limited") {
      response.setHeader("Retry-After", "86400");
      response.status(429).json({ error: "Request limit reached. Please try again later." });
      return;
    }
    if (claim.kind === "conflict") {
      response.status(409).json({ error: "Submission already exists. Retry with the original tracking token and unchanged request." });
      return;
    }
    if (claim.kind === "retry") {
      if (!claim.reply || (deployedRequests() && !await getAssetRequestStatus(claim.token))) {
        response.status(503).json({ error: "Request storage could not be verified. Please try again later.", trackingToken: claim.token });
        return;
      }
      response.status(claim.reply.status).json({ ...claim.reply.body, trackingUrl: `/requests?token=${encodeURIComponent(claim.token)}`, trackingToken: claim.token });
      return;
    }
    if (claim.kind === "pending") {
      response.setHeader("Retry-After", "5");
      response.status(409).json({ error: "Request is still in progress. Retry with the same submission and tracking token.", trackingToken: claim.token });
      return;
    }
    submission.trackingToken = claim.token;
    let databaseStored = false;
    let trackingUrl: string | null = null;
    if (requestStoreConfigured()) {
      try {
        trackingUrl = await saveAssetRequest(submission);
        if (!trackingUrl) throw new Error("Request tracking ownership conflict");
        databaseStored = true;
      } catch (error) {
        console.error("Request database persistence failed", error);
        if (deployedRequests()) throw error;
      }
    }
    if (deployedRequests() && !databaseStored) throw new Error("Durable request storage is unavailable");
    let emailDelivered = false;
    if (previewDeliveryDisabled()) {
      if (!databaseStored) throw new Error("Preview request storage is unavailable");
      const reply = { status: 202, body: { ok: true, issue: null, emailDelivered: false, trackingUrl, trackingToken: claim.token } };
      await claim.finish(reply);
      response.status(reply.status).json(reply.body);
      return;
    }
    await claim.beginDelivery();
    // From here onward, a timeout may hide a successful delivery. Never reclaim.
    externalStarted = true;
    try {
      await sendPrivateLogoRequest(submission, trackingUrl);
      emailDelivered = true;
    } catch (error) {
      console.error("Logo request maintainer email delivery failed", error);
    }

    let createdIssue = null;
    let metadataStored = false;
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

    if (!emailDelivered && !metadataStored && !databaseStored) {
      response.status(503).json({
        error: "We could not securely save your request right now. Please wait a moment and try again."
      });
      return;
    }

    const reply = { status: createdIssue ? 201 : 202, body: {
      ok: true,
      issue: createdIssue ? { number: createdIssue.number, url: createdIssue.html_url } : null,
      emailDelivered,
      trackingUrl,
      trackingToken: claim.token
    } };
    await claim.finish(reply);
    response.status(reply.status).json(reply.body);
  } catch (error) {
    if (activeClaim && !externalStarted) {
      try { await activeClaim.releaseStorage(); }
      catch { console.error("Request storage retry state could not be saved"); }
    }
    if (error instanceof ZodError) {
      response.status(400).json({ error: error.issues[0]?.message ?? "Check the form and try again." });
      return;
    }
    console.error("Logo request persistence failed", error);
    response.status(503).json({
      error: "We could not securely save your request right now. Please wait a moment and try again.",
      ...(activeClaim ? { trackingToken: activeClaim.token } : {})
    });
  }
}
