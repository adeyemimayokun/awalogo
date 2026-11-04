import type { VercelRequest, VercelResponse } from "./vercel-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import adminRequestsHandler from "../admin/requests";
import logoRequestsHandler from "../logo-requests";
import * as abuse from "./request-abuse";
import * as store from "./request-store";

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
  websiteConfirm: "",
  trackingToken: "a".repeat(43)
};
const originalEnvironment = { ...process.env };

function publicRequest(overrides: Partial<typeof submission> = {}): VercelRequest {
  return {
    method: "POST",
    body: { ...submission, ...overrides },
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
    delete process.env.VERCEL_ENV;
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.AWALOGO_LOCAL_ADMIN_BYPASS = "1";
    process.env.LOGO_REQUEST_STORAGE_SECRET =
      "test-request-storage-secret-that-is-longer-than-thirty-two-characters";
    process.env.RESEND_API_KEY = "test";
    process.env.LOGO_REQUEST_FROM_EMAIL = "requests@example.com";
    process.env.LOGO_REQUEST_INBOX = "maintainer@example.com";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 202 })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...originalEnvironment };
  });

  it("rejects over-budget requests before persistence or delivery", async () => {
    vi.spyOn(abuse, "claimLogoRequest").mockResolvedValue({ kind: "limited", token: "a".repeat(43), finish: vi.fn(), releaseStorage: vi.fn(), beginDelivery: vi.fn() });
    const save = vi.spyOn(store, "saveAssetRequest");
    const result = response();
    await logoRequestsHandler(publicRequest(), result);
    expect(result.statusCode).toBe(429);
    expect(save).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops deployed delivery if persistence fails after durable admission", async () => {
    process.env.VERCEL = "1";
    const releaseStorage = vi.fn();
    vi.spyOn(abuse, "claimLogoRequest").mockResolvedValue({ kind: "accepted", token: "a".repeat(43), finish: vi.fn(), releaseStorage, beginDelivery: vi.fn() });
    vi.spyOn(store, "requestStoreConfigured").mockReturnValue(true);
    vi.spyOn(store, "saveAssetRequest").mockRejectedValue(new Error("store offline"));
    const result = response();
    await logoRequestsHandler(publicRequest(), result);
    expect(result.statusCode).toBe(503);
    expect(releaseStorage).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a durable replay without any persistence or delivery calls", async () => {
    process.env.VERCEL = "1";
    vi.spyOn(store, "getAssetRequestStatus").mockResolvedValue({ brand_name: submission.institutionName, status: "pending", updated_at: "2026-11-02" });
    vi.spyOn(abuse, "claimLogoRequest").mockResolvedValue({ kind: "retry", token: "a".repeat(43), reply: { status: 201, body: { ok: true, issue: { number: 42 } } }, finish: vi.fn(), releaseStorage: vi.fn(), beginDelivery: vi.fn() });
    const save = vi.spyOn(store, "saveAssetRequest");
    const result = response();
    await logoRequestsHandler(publicRequest(), result);
    expect(result.statusCode).toBe(201);
    expect(result.body).toMatchObject({ ok: true, issue: { number: 42 }, trackingToken: "a".repeat(43) });
    expect(save).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects completed replay if durable tracking ownership cannot be verified", async () => {
    process.env.VERCEL = "1";
    vi.spyOn(store, "getAssetRequestStatus").mockResolvedValue(null);
    vi.spyOn(abuse, "claimLogoRequest").mockResolvedValue({ kind: "retry", token: submission.trackingToken, reply: { status: 201, body: { ok: true } }, finish: vi.fn(), releaseStorage: vi.fn(), beginDelivery: vi.fn() });
    const result = response();
    await logoRequestsHandler(publicRequest(), result);
    expect(result.statusCode).toBe(503);
    expect(result.body).not.toHaveProperty("ok");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([true, false])("replays interrupted delivery only with verified durable storage (%s)", async (stored) => {
    process.env.VERCEL = "1";
    const status = vi.spyOn(store, "getAssetRequestStatus").mockResolvedValue(stored
      ? { brand_name: submission.institutionName, status: "pending", updated_at: "2026-11-02" } : null);
    const beginDelivery = vi.fn(), releaseStorage = vi.fn(), finish = vi.fn();
    vi.spyOn(abuse, "claimLogoRequest").mockResolvedValue({ kind: "retry", token: submission.trackingToken,
      reply: { status: 202, body: { ok: true, issue: null, emailDelivered: false, deliveryStatus: "unconfirmed" } },
      finish, releaseStorage, beginDelivery });
    const save = vi.spyOn(store, "saveAssetRequest");
    const result = response();
    await logoRequestsHandler(publicRequest(), result);
    expect(status).toHaveBeenCalledWith(submission.trackingToken);
    expect(result.statusCode).toBe(stored ? 202 : 503);
    if (stored) expect(result.body).toMatchObject({ ok: true, issue: null, emailDelivered: false,
      deliveryStatus: "unconfirmed", trackingUrl: `/requests?token=${submission.trackingToken}` });
    else expect(result.body).not.toHaveProperty("ok");
    expect(save).not.toHaveBeenCalled();
    expect(beginDelivery).not.toHaveBeenCalled();
    expect(releaseStorage).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 409, not success, for an in-flight authenticated retry", async () => {
    vi.spyOn(abuse, "claimLogoRequest").mockResolvedValue({ kind: "pending", token: submission.trackingToken, finish: vi.fn(), releaseStorage: vi.fn(), beginDelivery: vi.fn() });
    const result = response();
    result.setHeader = vi.fn();
    await logoRequestsHandler(publicRequest(), result);
    expect(result.statusCode).toBe(409);
    expect(result.setHeader).toHaveBeenCalledWith("Retry-After", "5");
    expect(result.body).not.toHaveProperty("ok");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reclaims a failed storage attempt before delivery and replays only after persistence", async () => {
    // Exercise the real claim state machine locally with deployed handler semantics.
    vi.spyOn(abuse, "deployedRequests").mockReturnValue(true);
    vi.spyOn(store, "requestStoreConfigured").mockReturnValue(true);
    const save = vi.spyOn(store, "saveAssetRequest").mockRejectedValueOnce(new Error("store offline"))
      .mockResolvedValue(`/requests?token=${submission.trackingToken}`);
    vi.spyOn(store, "getAssetRequestStatus").mockResolvedValue({ brand_name: "Retry Finance", status: "pending", updated_at: "2026-11-02" });
    const req = publicRequest({ submissionId: "2648063d-cb8d-4583-a193-044d6f4c9dcd", institutionName: "Retry Finance", email: "storage-retry@example.com" });
    const failed = response();
    await logoRequestsHandler(req, failed);
    expect(failed.statusCode).toBe(503);
    expect(failed.body).not.toHaveProperty("ok");
    expect(fetch).not.toHaveBeenCalled();
    const retried = response();
    await logoRequestsHandler(req, retried);
    expect(retried.statusCode).toBe(201);
    expect(retried.body).toMatchObject({ ok: true });
    expect(save).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    const replay = response();
    await logoRequestsHandler(req, replay);
    expect(replay.statusCode).toBe(201);
    expect(save).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("still accepts an initial V1 request without a tracking token", async () => {
    const req = publicRequest({ submissionId: "2648063d-cb8d-4583-a193-044d6f4c9dce", institutionName: "Legacy Finance", email: "legacy@example.com" });
    delete req.body.trackingToken;
    const result = response();
    await logoRequestsHandler(req, result);
    expect(result.statusCode).toBe(201);
    expect(result.body).toMatchObject({ ok: true, trackingToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
  });

  it("blocks an actual concurrent request while the first persistence call is in flight", async () => {
    vi.spyOn(store, "requestStoreConfigured").mockReturnValue(true);
    let completeSave!: (url: string) => void;
    let started!: () => void;
    const saving = new Promise<string>(resolve => { completeSave = resolve; });
    const entered = new Promise<void>(resolve => { started = resolve; });
    const save = vi.spyOn(store, "saveAssetRequest").mockImplementation(() => { started(); return saving; });
    const req = publicRequest({ submissionId: "2648063d-cb8d-4583-a193-044d6f4c9dcf", institutionName: "Inflight Finance", email: "inflight@example.com" });
    Object.assign(req, { socket: { remoteAddress: "192.0.2.99" } });
    const first = response();
    const running = logoRequestsHandler(req, first);
    await entered;
    const pending = response();
    await logoRequestsHandler(req, pending);
    expect(pending.statusCode).toBe(409);
    expect(pending.body).not.toHaveProperty("ok");
    expect(save).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    completeSave(`/requests?token=${submission.trackingToken}`);
    await running;
    expect(first.statusCode).toBe(201);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("never releases a claim after external delivery may have started", async () => {
    const releaseStorage = vi.fn();
    vi.spyOn(abuse, "claimLogoRequest").mockResolvedValue({ kind: "accepted", token: submission.trackingToken, finish: vi.fn().mockRejectedValue(new Error("reply storage failed")), releaseStorage, beginDelivery: vi.fn() });
    const result = response();
    await logoRequestsHandler(publicRequest({ institutionName: "Ambiguous Delivery Finance" }), result);
    expect(result.statusCode).toBe(503);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(releaseStorage).not.toHaveBeenCalled();
  });

  it("stores one idempotent request and exposes its private fields only to the admin API", async () => {
    const created = response();
    await logoRequestsHandler(publicRequest(), created);
    expect(created.statusCode).toBe(201);

    const retried = response();
    await logoRequestsHandler(publicRequest(), retried);
    expect(retried.statusCode).toBe(201);
    expect(retried.body).toMatchObject({ issue: (created.body as { issue: unknown }).issue });
    expect(fetch).toHaveBeenCalledTimes(2);

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

  it("accepts local requests without production email or storage configuration", async () => {
    delete process.env.LOGO_REQUEST_STORAGE_SECRET;
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.RESEND_API_KEY;
    delete process.env.LOGO_REQUEST_FROM_EMAIL;
    delete process.env.LOGO_REQUEST_INBOX;
    const localSubmission = {
      submissionId: "dc3c4091-6f03-4ccb-8351-8ae3dbd66f0e",
      institutionName: "Local Request Finance"
    };

    const created = response();
    await logoRequestsHandler(publicRequest(localSubmission), created);

    expect(created.statusCode).toBe(201);
    expect(created.body).toMatchObject({ ok: true, emailDelivered: false });

    const dashboard = response();
    await adminRequestsHandler(adminRequest(), dashboard);
    const requests = (dashboard.body as {
      requests: Array<{ institution: string; email: string | null; assetUrl: string | null }>;
    }).requests;
    expect(requests).toContainEqual(expect.objectContaining({
      institution: localSubmission.institutionName,
      email: submission.email,
      assetUrl: submission.logoAssetUrl
    }));
  });

  it("fails closed without durable abuse protection even when email works", async () => {
    process.env.VERCEL = "1";
    process.env.GITHUB_ADMIN_TOKEN = "test-token";
    delete process.env.LOGO_REQUEST_STORAGE_SECRET;
    delete process.env.ADMIN_SESSION_SECRET;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return url.includes("api.resend.com")
        ? new Response(null, { status: 202 })
        : new Response("GitHub unavailable", { status: 503 });
    }));

    const created = response();
    await logoRequestsHandler(publicRequest({
      submissionId: "75a37fb7-e4ab-46ef-8855-80ca84dd105f"
    }), created);

    expect(created.statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports a temporary failure when no private delivery route accepts the request", async () => {
    process.env.VERCEL = "1";
    process.env.GITHUB_ADMIN_TOKEN = "test-token";
    delete process.env.LOGO_REQUEST_STORAGE_SECRET;
    delete process.env.ADMIN_SESSION_SECRET;
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unavailable", { status: 503 })));

    const failed = response();
    await logoRequestsHandler(publicRequest({
      submissionId: "e84e945f-6887-46e6-92ef-72914e94c307"
    }), failed);

    expect(failed.statusCode).toBe(503);
    expect(failed.body).toMatchObject({
      error: "We could not securely save your request right now. Please wait a moment and try again."
    });
  });

  it("does not use Supabase as a non-atomic deployed abuse fallback", async () => {
    process.env.VERCEL = "1";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "test-server-key";
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input); calls.push(url);
      if (url.includes("example.supabase.co")) return url.includes("on_conflict") ? new Response(null, { status: 204 }) : Response.json([{ submission_id: submission.submissionId }]);
      return new Response("Unavailable", { status: 503 });
    }));
    const saved = response();
    await logoRequestsHandler(publicRequest(), saved);
    expect(calls).toEqual([]);
    expect(saved.statusCode).toBe(503);
  });

  it("does not send email when deployed durable storage is unavailable", async () => {
    process.env.VERCEL = "1";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "test-server-key";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => String(input).includes("api.resend.com") ? new Response(null, { status: 202 }) : new Response(null, { status: 503 })));
    const saved = response();
    await logoRequestsHandler(publicRequest(), saved);
    expect(saved.statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
});
