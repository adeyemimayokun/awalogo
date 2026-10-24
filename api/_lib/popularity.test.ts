import { afterEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handlePopularity } from "./popularity.js";

function request(method = "GET", body?: unknown, origin = "https://awalogo.com") {
  return { method, body, headers: { host: "awalogo.com", origin, "x-vercel-forwarded-for": "192.0.2.1" } } as unknown as VercelRequest;
}
function response() {
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as VercelResponse;
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("aggregate download API", () => {
  it("rejects cross-origin writes before calling storage", async () => {
    const res = response(); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await handlePopularity(request("POST", { slugs: ["opay"] }, "https://other.example"), res);
    expect(res.status).toHaveBeenCalledWith(403); expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects unknown logos and oversized batches", async () => {
    for (const slugs of [["not-in-catalog"], Array(51).fill("opay")]) {
      const res = response(); await handlePopularity(request("POST", { slugs }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });
  it("returns aggregate counts only", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ slug: "opay", downloads: 10 }, { slug: "bad", downloads: 50 }]))));
    const res = response(); await handlePopularity(request(), res);
    expect(res.json).toHaveBeenCalledWith({ counts: { opay: 10 } });
  });
  it("deduplicates bundle slugs and never sends the IP to storage", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal("fetch", fetcher);
    const res = response(); await handlePopularity(request("POST", { slugs: ["opay", "opay"] }), res);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.requested_slugs).toEqual(["opay"]); expect(body.network_key).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(body)).not.toContain("192.0.2.1"); expect(res.status).toHaveBeenCalledWith(202);
  });
  it("fails safely when the database is unavailable", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", ""); const res = response();
    await handlePopularity(request(), res);
    expect(res.status).toHaveBeenCalledWith(503); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ counts: {} }));
  });
});
