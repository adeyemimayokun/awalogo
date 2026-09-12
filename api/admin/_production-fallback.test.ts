import type { VercelRequest, VercelResponse } from "@vercel/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueSession } from "../_lib/auth";
import catalogHandler from "./catalog";
import notificationsHandler from "./notifications";
import requestsHandler from "./requests";

type TestResponse = VercelResponse & {
  body?: unknown;
  statusCode: number;
};

function response(): TestResponse {
  const headers = new Map<string, string | string[] | number>();
  return {
    statusCode: 200,
    body: undefined,
    setHeader(name: string, value: string | string[] | number) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  } as TestResponse;
}

function adminRequest(): VercelRequest {
  const sessionResponse = response();
  issueSession(sessionResponse, "maintainer", "https://example.com/avatar.png");
  const setCookie = sessionResponse.getHeader("Set-Cookie");
  const cookie = (Array.isArray(setCookie) ? setCookie[0] : String(setCookie)).split(";")[0];
  return {
    method: "GET",
    headers: { host: "awalogo.com", cookie },
    query: {}
  } as VercelRequest;
}

const originalEnvironment = { ...process.env };

describe("production admin read fallbacks", () => {
  beforeEach(() => {
    process.env.VERCEL = "1";
    process.env.NODE_ENV = "production";
    process.env.ADMIN_SESSION_SECRET = "test-secret-that-is-definitely-longer-than-thirty-two-characters";
    process.env.ADMIN_GITHUB_LOGINS = "maintainer";
    delete process.env.GITHUB_ADMIN_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnvironment };
  });

  it("serves the deployment catalog without a GitHub token", async () => {
    const result = response();
    await catalogHandler(adminRequest(), result);

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      catalogSource: "deployment-bundle",
      localPreview: false
    });
    expect((result.body as { catalog: unknown[] }).catalog.length).toBeGreaterThan(200);
  });

  it("returns an unavailable notification integration without a 500", async () => {
    const result = response();
    await notificationsHandler(adminRequest(), result);

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      notifications: [],
      integration: { available: false }
    });
  });

  it("returns an unavailable request integration without a 500", async () => {
    const result = response();
    await requestsHandler(adminRequest(), result);

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      requests: [],
      integration: { available: false }
    });
  });

  it("shows delivered email requests when GitHub is unavailable", async () => {
    process.env.RESEND_API_KEY = "test";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("api.github.com")) return new Response("Bad credentials", { status: 401 });
      if (url.endsWith("/emails?limit=20")) {
        return Response.json({ data: [{ id: "email-1", subject: "Logo request: Source MFB", created_at: "2026-09-12T11:52:51.000Z" }] });
      }
      return Response.json({
        id: "email-1",
        subject: "Logo request: Source MFB",
        created_at: "2026-09-12T11:52:51.000Z",
        text: [
          "Company or product: Source MFB",
          "Type of company: Bank",
          "Company website: https://mysourcebank.com/",
          "Contributor email: requester@example.com",
          "Logo file link: Not provided",
          "Notify when available: Yes",
          "Submission ID: ec932b27-3abc-4c98-9f0c-d44f2b85156a"
        ].join("\n")
      });
    }));

    const result = response();
    await requestsHandler(adminRequest(), result);

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      requests: [{ institution: "Source MFB", number: null, source: "email", status: "pending" }],
      integration: { available: false }
    });
  });
});
