import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dateRange, dashboardView, dashboardMutation } from "./admin-dashboard";
import { safeArtwork } from "./admin-resource-mutations";
import catalogHandler from "../admin/catalog";
import mutateHandler from "../admin/mutate";
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
describe("dashboard boundaries", () => {
  beforeEach(() => {
    vi.stubEnv("AWALOGO_LOCAL_ADMIN_BYPASS", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("ADMIN_ANALYTICS_VERCEL_TOKEN", "");
    vi.stubEnv("ADMIN_ANALYTICS_PROJECT_ID", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("validates and calculates equal inclusive comparison ranges", () => {
    expect(dateRange({ since: "2026-01-08", until: "2026-01-14" })).toEqual({
      since: "2026-01-08",
      until: "2026-01-14",
      previousSince: "2026-01-01",
      previousUntil: "2026-01-07",
    });
    expect(() =>
      dateRange({ since: "2026-02-30", until: "2026-03-03" }),
    ).toThrow();
    expect(() =>
      dateRange({ since: "2025-01-01", until: "2026-02-03" }),
    ).toThrow();
  });
  it("keeps unavailable data distinct from empty counts", async () => {
    const data = (await dashboardView("analytics", { days: "7" })) as any;
    expect(data.traffic.day.state).toBe("unconfigured");
    expect(data.traffic.day.rows).toBeUndefined();
    expect(data.product.state).toBe("unconfigured");
  });
  it("denies unauthenticated catalog and cross-origin mutations", async () => {
    const a = response();
    await catalogHandler(
      { method: "GET", query: { view: "resources" }, headers: {} } as any,
      a,
    );
    expect(a.code).toBe(401);
    const b = response();
    await mutateHandler(
      {
        method: "POST",
        query: { view: "plugin" },
        headers: { host: "awalogo.com", origin: "https://other.test" },
      } as any,
      b,
    );
    expect(b.code).toBe(403);
  });
  it("rejects invented plugin sources and future observations", async () => {
    await expect(
      dashboardMutation(
        "plugin",
        {
          count: 1,
          sourceUrl: "https://evil.test",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
        "admin",
      ),
    ).rejects.toThrow();
    await expect(
      dashboardMutation(
        "plugin",
        {
          count: 1,
          sourceUrl:
            "https://www.figma.com/community/plugin/1661356348996631383/awalogo",
          observedAt: "2099-01-01T00:00:00.000Z",
        },
        "admin",
      ),
    ).rejects.toThrow();
  });
  it("requires resolution notes", async () => {
    await expect(
      dashboardMutation(
        "report-triage",
        {
          id: "39b54fc7-7ce2-410d-8a2d-f0235cae893a",
          status: "resolved",
          note: "",
        },
        "admin",
      ),
    ).rejects.toThrow("resolution note");
  });
  it("rejects SVG active content, external resources and file-type spoofing", async () => {
    for (const text of [
      '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>',
      '<svg viewBox="0 0 1 1"><use href="https://evil.test/a"/></svg>',
      '<svg viewBox="0 0 1 1"><rect onclick="x()"/></svg>',
    ])
      await expect(
        safeArtwork({
          base64: Buffer.from(text).toString("base64"),
          type: "svg",
        }),
      ).rejects.toThrow();
    await expect(
      safeArtwork({
        base64: Buffer.from('<svg viewBox="0 0 1 1"/>').toString("base64"),
        type: "png",
      }),
    ).rejects.toThrow();
  });
});
