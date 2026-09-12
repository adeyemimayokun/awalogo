import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listDeliveredLogoRequests, sendPrivateLogoRequest } from "./email";

const request = {
  submissionId: "a0ec6ec5-6dde-4bea-b5c4-3cfdcb9b65fe",
  institutionName: "Example Finance",
  officialWebsite: "https://example.com/",
  email: "designer@example.com",
  category: "Fintech" as const,
  logoAssetUrl: "",
  notifyWhenAvailable: true,
  websiteConfirm: "" as const
};
const originalEnvironment = { ...process.env };

describe("logo request email delivery", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "test";
    process.env.LOGO_REQUEST_FROM_EMAIL = "requests@example.com";
    process.env.LOGO_REQUEST_INBOX = "maintainer@example.com";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnvironment };
  });

  it("uses the shared HTML templates for maintainer and requester messages", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetch);

    await sendPrivateLogoRequest(request);

    expect(fetch).toHaveBeenCalledTimes(2);
    const calls = fetch.mock.calls as unknown as Array<[string, RequestInit]>;
    const payloads = calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(payloads[0]).toMatchObject({
      to: ["maintainer@example.com"],
      reply_to: "designer@example.com",
      subject: "Logo request: Example Finance"
    });
    expect(payloads[1]).toMatchObject({ to: ["designer@example.com"] });
    expect(payloads.every((payload) => typeof payload.html === "string" && String(payload.html).includes("awalogo"))).toBe(true);
    expect(payloads.every((payload) => typeof payload.text === "string")).toBe(true);
  });

  it("reconstructs an admin request from a delivered maintainer email", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/emails?limit=20")) {
        return Response.json({ data: [{ id: "email-1", subject: "Logo request: Source MFB", created_at: "2026-09-12T11:52:51.000Z" }] });
      }
      return Response.json({
        id: "email-1",
        subject: "Logo request: Source MFB",
        created_at: "2026-09-12T11:52:51.000Z",
        text: [
          "A new logo request was submitted through awalogo.com.",
          "",
          "Company or product: Source MFB",
          "Type of company: Bank",
          "Company website: https://mysourcebank.com/",
          "Contributor email: requester@example.com",
          "Logo file link: Not provided",
          "Notify when available: Yes",
          "",
          "Submission ID: ec932b27-3abc-4c98-9f0c-d44f2b85156a"
        ].join("\n")
      });
    }));

    await expect(listDeliveredLogoRequests()).resolves.toEqual([{
      id: "email-1",
      submissionId: "ec932b27-3abc-4c98-9f0c-d44f2b85156a",
      institution: "Source MFB",
      category: "Bank",
      website: "https://mysourcebank.com/",
      email: "requester@example.com",
      assetUrl: null,
      notifyWhenAvailable: true,
      submittedAt: "2026-09-12T11:52:51.000Z"
    }]);
  });
});
