import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), attach: vi.fn(), end: vi.fn().mockResolvedValue(undefined), pools: vi.fn() }));
vi.mock("pg", () => ({ types: { getTypeParser: vi.fn() }, Pool: class {
  constructor(options: unknown) { mocks.pools(options); }
  query = mocks.query;
  end = mocks.end;
  on = vi.fn();
} }));
vi.mock("@vercel/functions", () => ({ attachDatabasePool: mocks.attach }));
import { compileStoreQuery, neonStore } from "./neon-store";
import { adminStore, adminStoreConfigured } from "./admin-store";
import { getAssetRequestStatus, requestStoreConfigured } from "./request-store";

beforeEach(() => { mocks.end.mockResolvedValue(undefined); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Neon database compatibility", () => {
  it("binds filter values rather than interpolating SQL", () => {
    const injection = "x' OR 1=1 --";
    const query = compileStoreQuery(`asset_requests?select=brand_name,status&tracking_token_hash=eq.${encodeURIComponent(injection)}&limit=1`);
    expect(query.text).toBe('SELECT "brand_name","status" FROM public.asset_requests WHERE "tracking_token_hash" = $1 LIMIT $2');
    expect(query.text).not.toContain(injection);
    expect(query.values).toEqual([injection, 1]);
  });
  it("supports repeated date filters, status sets, ordering, and pagination", () => {
    expect(compileStoreQuery("product_event_daily?day=gte.2026-01-01&day=lte.2026-02-01&order=day.asc&limit=1000&offset=2000").values).toEqual(["2026-01-01", "2026-02-01", 1000, 2000]);
    expect(compileStoreQuery("asset_reports?status=in.(pending,in-review)").values).toEqual([["pending", "in-review"]]);
  });
  it("supports idempotent submissions and returned status updates", () => {
    const insert = compileStoreQuery("asset_requests?on_conflict=submission_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ submission_id: "id", brand_name: "Test" }) });
    expect(insert.text).toContain("ON CONFLICT (submission_id) DO NOTHING");
    expect(insert.minimal).toBe(true);
    const patch = compileStoreQuery("asset_requests?submission_id=eq.id&select=status", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "approved" }) });
    expect(patch.text).toBe('UPDATE public.asset_requests SET "status" = $2 WHERE "submission_id" = $1 RETURNING "status"');
    expect(patch.values).toEqual(["id", "approved"]);
  });
  it("binds procedure arguments in their declared order", () => {
    expect(compileStoreQuery("rpc/record_logo_downloads", { method: "POST", body: JSON.stringify({ network_key: "hash", requested_slugs: ["access-bank"] }) })).toEqual({ text: "SELECT public.record_logo_downloads($1,$2)", values: [["access-bank"], "hash"], minimal: true });
  });
  it.each([
    "asset_requests;DROP TABLE users", "asset_requests?select=password", "asset_requests?order=status.desc;delete",
    "asset_requests?status=like.%", "asset_requests?limit=-1", "asset_requests?offset=10001", "rpc/unknown",
  ])("rejects unsupported SQL surface: %s", (path) => {
    expect(() => compileStoreQuery(path)).toThrow();
  });
  it("rejects broad updates, deletes, unknown payload keys, and writable counters", () => {
    expect(() => compileStoreQuery("asset_requests", { method: "PATCH", body: '{"status":"approved"}' })).toThrow();
    expect(() => compileStoreQuery("asset_reports", { method: "DELETE" })).toThrow();
    expect(() => compileStoreQuery("asset_requests", { method: "POST", body: '{"secret":"x"}' })).toThrow();
    expect(() => compileStoreQuery("logo_download_totals", { method: "POST", body: '{"slug":"x"}' })).toThrow();
    expect(() => compileStoreQuery("rpc/record_product_event", { method: "POST", body: '{"unknown":true}' })).toThrow();
  });
  it("prefers Neon with both providers configured and preserves API JSON types", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test?sslmode=require");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test");
    const fetch = vi.spyOn(globalThis, "fetch");
    mocks.query.mockResolvedValueOnce({ rows: [{ downloads: "12", updated_at: new Date("2026-01-01T00:00:00Z") }] });
    expect(adminStoreConfigured()).toBe(true);
    expect(requestStoreConfigured()).toBe(true);
    expect(await adminStore("logo_download_totals")).toEqual([{ downloads: 12, updated_at: "2026-01-01T00:00:00.000Z" }]);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.attach).toHaveBeenCalled();
    const options = mocks.pools.mock.calls.at(-1)![0];
    expect(options.connectionString).toContain("sslmode=verify-full");
    expect(options.types.getTypeParser(1082)("2026-01-01")).toBe("2026-01-01");
  });
  it("does not fall back to a different provider after a Neon error", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    const fetch = vi.spyOn(globalThis, "fetch");
    mocks.query.mockRejectedValueOnce(new Error("offline"));
    await expect(getAssetRequestStatus("a".repeat(43))).rejects.toThrow("offline");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("refuses unsafe bigint counts", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    mocks.query.mockResolvedValueOnce({ rows: [{ downloads: "9007199254740992" }] });
    await expect(neonStore("logo_download_totals")).rejects.toThrow("safe integer");
  });
});
