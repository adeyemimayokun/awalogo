import type { VercelRequest, VercelResponse } from "@vercel/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issueSession } from "./auth";
import catalogHandler from "../admin/catalog";
import notificationsHandler from "../admin/notifications";
import requestsHandler from "../admin/requests";

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
});
