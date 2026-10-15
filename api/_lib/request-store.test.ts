import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAssetRequestStatus, saveAssetRequest } from "./request-store";

const originalEnvironment = { ...process.env };
const submission = {
  submissionId: "a0ec6ec5-6dde-4bea-b5c4-3cfdcb9b65fe",
  trackingToken: "t".repeat(43),
  institutionName: "Example Brand",
  officialWebsite: "https://example.com",
  email: "requester@example.com",
  category: "Other" as const,
  logoAssetUrl: "",
  notifyWhenAvailable: true,
  websiteConfirm: "" as const
};
describe("durable private requests", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "test-server-secret";
    process.env.LOGO_REQUEST_STORAGE_SECRET = "a-stable-test-secret-of-at-least-thirty-two-characters";
  });
  afterEach(() => { process.env = { ...originalEnvironment }; vi.unstubAllGlobals(); });
  it("stores a hash rather than the private tracking token and preserves idempotency", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => { calls.push({ url, init }); return init?.method === "POST" ? new Response(null, { status: 204 }) : Response.json([{ submission_id: submission.submissionId }]); }));
    const first = await saveAssetRequest(submission);
    const second = await saveAssetRequest(submission);
    expect(first).toBe(second);
    const token = new URL(first!, "https://awalogo.com").searchParams.get("token")!;
    expect(token).toHaveLength(43);
    expect(String(calls[0].init?.body)).not.toContain(token);
    expect(calls[0].url).toContain("on_conflict=submission_id");
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ brand_name: "Example Brand", contact_email: "requester@example.com" });
  });
  it("exposes only public tracking fields", async () => {
    const fetch = vi.fn(async () => Response.json([{ brand_name: "Example Brand", status: "pending", updated_at: "2026-10-14" }]));
    vi.stubGlobal("fetch", fetch);
    expect(await getAssetRequestStatus("a".repeat(43))).toEqual({ brand_name: "Example Brand", status: "pending", updated_at: "2026-10-14" });
    const url = String((fetch.mock.calls as unknown as Array<[string]>)[0][0]);
    expect(url).not.toContain("contact_email");
    expect(url).not.toContain("a".repeat(43));
  });
  it("rejects malformed tracking tokens without querying the database", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await getAssetRequestStatus("invalid")).toBeNull(); expect(fetch).not.toHaveBeenCalled();
  });
  it("does not return tracking access when a public submission ID is reused with a different token", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST" ? new Response(null, { status: 204 }) : Response.json([])));
    expect(await saveAssetRequest({ ...submission, trackingToken: "x".repeat(43) })).toBeNull();
  });
  it("does not treat failed database persistence as a saved request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    await expect(saveAssetRequest(submission)).rejects.toThrow("Request database operation failed");
  });
});
