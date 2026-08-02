import type { VercelRequest, VercelResponse } from "@vercel/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import adminRequestsHandler from "../admin/requests";
import logoRequestsHandler from "../logo-requests";

type TestResponse = VercelResponse & { body?: unknown; statusCode: number };

function response(): TestResponse {
  const result = { statusCode: 200, body: undefined } as unknown as TestResponse;
  result.setHeader = (() => result) as TestResponse["setHeader"];
  result.status = ((code: number) => {
    result.statusCode = code;
    return result;
  }) as TestResponse["status"];
  result.json = ((body: unknown) => {
    result.body = body;
    return result;
  }) as TestResponse["json"];
  return result;
}

const submission = {
  submissionId: "a37cca64-81a0-4620-a051-5401a765f52e",
  institutionName: "Durable Request Finance",
  officialWebsite: "https://example.com/",
  email: "requester@example.com",
  category: "Fintech",
  logoAssetUrl: "https://drive.google.com/file/d/request/view",
  notifyWhenAvailable: true,
  websiteConfirm: ""
};
const originalEnvironment = { ...process.env };

function publicRequest(): VercelRequest {
  return {
    method: "POST",
    body: submission,
    headers: {
      host: "127.0.0.1:5174",
      origin: "http://127.0.0.1:5174",
      "x-forwarded-proto": "http"
    },
    query: {}
  } as unknown as VercelRequest;
}

function adminRequest(): VercelRequest {
  return {
    method: "GET",
    headers: {
      host: "127.0.0.1:5174",
      "x-awalogo-local-admin": "1"
    },
    query: {}
  } as unknown as VercelRequest;
}

describe("website logo request persistence", () => {
  beforeEach(() => {
    delete process.env.VERCEL;
    process.env.AWALOGO_LOCAL_ADMIN_BYPASS = "1";
    process.env.LOGO_REQUEST_STORAGE_SECRET =
      "test-request-storage-secret-that-is-longer-than-thirty-two-characters";
    process.env.RESEND_API_KEY = "test";
    process.env.LOGO_REQUEST_FROM_EMAIL = "requests@example.com";
    process.env.LOGO_REQUEST_INBOX = "maintainer@example.com";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 202 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnvironment };
  });

  it("stores one idempotent request and exposes its private fields only to the admin API", async () => {
    const created = response();
    await logoRequestsHandler(publicRequest(), created);
    expect(created.statusCode).toBe(201);

    const retried = response();
    await logoRequestsHandler(publicRequest(), retried);
    expect(retried.statusCode).toBe(200);
    expect(retried.body).toMatchObject({ issue: (created.body as { issue: unknown }).issue });

    const dashboard = response();
    await adminRequestsHandler(adminRequest(), dashboard);
    const requests = (dashboard.body as {
      requests: Array<{ institution: string; email: string | null; assetUrl: string | null }>;
    }).requests;
    expect(requests.filter((item) => item.institution === submission.institutionName)).toEqual([
      expect.objectContaining({
        email: submission.email,
        assetUrl: submission.logoAssetUrl
      })
    ]);
  });
});
