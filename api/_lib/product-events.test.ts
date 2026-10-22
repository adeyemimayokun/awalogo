import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleProductEvents } from "./product-events";
import { adminResources } from "./admin-resources";
function response() {
  const r: any = {
    code: 0,
    body: null,
    setHeader: vi.fn(),
    status(n: number) {
      r.code = n;
      return r;
    },
    json(body: unknown) {
      r.body = body;
      return r;
    },
  };
  return r;
}
const fixture = {
  method: "POST",
  query: { view: "events" },
  headers: { host: "awalogo.com", origin: "https://awalogo.com" },
  body: {
    id: "39b54fc7-7ce2-410d-8a2d-f0235cae893a",
    event: "download",
    resource: adminResources()[0].id,
    format: "svg",
  },
};
beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("ENABLE_PRODUCT_ANALYTICS", "true");
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "private-test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("production product collection", () => {
  it("excludes previews and privacy opt-outs without writing", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const headers of [
      { ...fixture.headers, dnt: "1" },
      { ...fixture.headers, "sec-gpc": "1" },
    ]) {
      const res = response();
      await handleProductEvents({ ...fixture, headers } as any, res);
      expect(res.body.disabled).toBe(true);
    }
    vi.stubEnv("VERCEL_ENV", "preview");
    const res = response();
    await handleProductEvents(fixture as any, res);
    expect(res.body.disabled).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects foreign origins and arbitrary payloads", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const a = response();
    await handleProductEvents(
      {
        ...fixture,
        headers: { ...fixture.headers, origin: "https://evil.test" },
      } as any,
      a,
    );
    expect(a.code).toBe(403);
    const b = response();
    await handleProductEvents(
      {
        ...fixture,
        body: { ...fixture.body, email: "private@example.com" },
      } as any,
      b,
    );
    expect(b.code).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not block user actions when storage is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const res = response();
    await handleProductEvents(
      {
        ...fixture,
        body: {
          ...fixture.body,
          event: "search",
          resource: "",
          format: "",
          detail: "0",
        },
      } as any,
      res,
    );
    expect(res.code).toBe(503);
  });
});
