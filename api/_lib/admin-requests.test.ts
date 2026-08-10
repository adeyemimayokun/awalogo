import type { VercelRequest, VercelResponse } from "@vercel/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import requestsHandler from "../admin/requests";

type TestResponse = VercelResponse & { body?: unknown; statusCode: number };

function response(): TestResponse {
  const result = {
    statusCode: 200,
    body: undefined
  } as unknown as TestResponse;
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

function request(method: "GET" | "PATCH", body?: unknown): VercelRequest {
  return {
    method,
    body,
    headers: {
      host: "127.0.0.1:5174",
      "x-awalogo-local-admin": "1"
    },
    query: {}
  } as unknown as VercelRequest;
}

const originalEnvironment = { ...process.env };

describe("admin request status updates", () => {
  beforeEach(() => {
    delete process.env.VERCEL;
    process.env.AWALOGO_LOCAL_ADMIN_BYPASS = "1";
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("stores status without creating or replacing repository labels", async () => {
    const updated = response();
    await requestsHandler(request("PATCH", { number: 104, status: "needs-info" }), updated);

    expect(updated.statusCode).toBe(200);
    expect(updated.body).toMatchObject({
      request: { number: 104, status: "needs-info", state: "open" }
    });

    const listed = response();
    await requestsHandler(request("GET"), listed);
    expect((listed.body as { requests: Array<{ number: number; status: string }> }).requests)
      .toContainEqual(expect.objectContaining({ number: 104, status: "needs-info" }));
    expect((listed.body as { requests: Array<{ number: number }> }).requests)
      .toContainEqual(expect.objectContaining({ number: 104 }));
  });

  it("reopens a resolved request when its status changes back to pending", async () => {
    const completed = response();
    await requestsHandler(request("PATCH", { number: 104, status: "completed" }), completed);
    expect(completed.body).toMatchObject({ request: { status: "completed", state: "closed" } });

    const pending = response();
    await requestsHandler(request("PATCH", { number: 104, status: "pending" }), pending);
    expect(pending.body).toMatchObject({ request: { status: "pending", state: "open" } });
  });
});
