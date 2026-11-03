import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { VercelRequest } from "./vercel-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimLogoRequest, requestAbuseKeys } from "./request-abuse.js";
import type { PublicLogoRequest } from "./logo-requests.js";

const query = vi.hoisted(() => vi.fn());
vi.mock("pg", () => ({ Pool: class { query = query; on() {} end() { return Promise.resolve(); } } }));
vi.mock("@vercel/functions", () => ({ attachDatabasePool: vi.fn() }));
const request = (ip = "192.0.2.1") => ({ headers: { "x-vercel-forwarded-for": ip }, socket: { remoteAddress: ip } }) as unknown as VercelRequest;
const submission = (): PublicLogoRequest => ({ submissionId: randomUUID(), trackingToken: "a".repeat(43), institutionName: "Test Finance", officialWebsite: "https://example.com", email: `${randomUUID()}@example.com`, category: "Fintech", logoAssetUrl: "", notifyWhenAvailable: true, websiteConfirm: "" });

describe("logo request abuse admission", () => {
  beforeEach(() => { vi.stubEnv("VERCEL", ""); vi.stubEnv("VERCEL_ENV", ""); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("DATABASE_URL", ""); query.mockReset(); });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

  it("locks the durable receipt before reading its phase or reclaiming its lease", async () => {
    const sql = await readFile(resolve("neon/migrations/002_request_abuse.sql"), "utf8");
    const lockedRead = /SELECT\s+\*\s+INTO\s+prior\s+FROM\s+public\.logo_request_receipts\s+WHERE\s+submission_id\s*=\s*id\s+FOR\s+UPDATE\s*;/i;
    expect(sql).toMatch(lockedRead);
    const lockOffset = sql.search(lockedRead);
    expect(lockOffset).toBeLessThan(sql.indexOf("IF prior.token_hash"));
    expect(lockOffset).toBeLessThan(sql.indexOf("IF prior.reply->>'retryStorage'"));
    expect(lockOffset).toBeLessThan(sql.indexOf("UPDATE public.logo_request_receipts SET reply="));
  });

  it("atomically admits only one concurrent UUID and authenticates retries", async () => {
    const item = submission();
    const claims = await Promise.all(Array.from({ length: 10 }, () => claimLogoRequest(request("192.0.2.11"), item)));
    expect(claims.filter(x => x.kind === "accepted")).toHaveLength(1);
    expect(claims.filter(x => x.kind === "pending")).toHaveLength(9);
    expect((await claimLogoRequest(request(), { ...item, trackingToken: "b".repeat(43) })).kind).toBe("conflict");
    expect((await claimLogoRequest(request(), { ...item, institutionName: "Changed" })).kind).toBe("conflict");
    await claims[0].finish({ status: 201, body: { ok: true } });
    expect((await claimLogoRequest(request(), item)).reply).toEqual({ status: 201, body: { ok: true } });
  });

  it("caps recipient across networks and network across recipients", async () => {
    const email = submission().email;
    for (let i = 0; i < 3; i++) expect((await claimLogoRequest(request(`192.0.3.${i + 1}`), { ...submission(), email })).kind).toBe("accepted");
    expect((await claimLogoRequest(request("192.0.3.9"), { ...submission(), email })).kind).toBe("limited");
    for (let i = 0; i < 5; i++) expect((await claimLogoRequest(request("192.0.4.1"), submission())).kind).toBe("accepted");
    expect((await claimLogoRequest(request("192.0.4.1"), submission())).kind).toBe("limited");
  });

  it("uses keyed hashes and groups canonical IPv6 /64 networks", () => {
    const item = submission();
    const a = requestAbuseKeys(request("2001:db8::1"), item);
    const b = requestAbuseKeys(request("2001:0db8:0000:0000::2"), { ...item, email: item.email.toUpperCase() });
    expect(a).toEqual(b);
    expect(a.network).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(a)).not.toContain(item.email);
  });

  it("fails closed in deployment without secret, database or trusted network", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("LOGO_REQUEST_ABUSE_SECRET", "");
    await expect(claimLogoRequest(request(), submission())).rejects.toThrow("secret");
    vi.stubEnv("LOGO_REQUEST_ABUSE_SECRET", "s".repeat(32));
    await expect(claimLogoRequest(request(), submission())).rejects.toThrow("store");
    await expect(claimLogoRequest({ headers: { "x-forwarded-for": "192.0.2.1" } } as unknown as VercelRequest, submission())).rejects.toThrow("network");
  });

  it("uses a parameterized durable claim and stores no raw tracking token in replies", async () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("LOGO_REQUEST_ABUSE_SECRET", "s".repeat(32)); vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    query.mockResolvedValueOnce({ rows: [{ decision: { kind: "accepted", leaseId: "test-lease" } }] }).mockResolvedValue({ rows: [{ submission_id: "test" }] });
    const item = submission();
    const claim = await claimLogoRequest(request(), item);
    expect(query.mock.calls[0][0]).toContain("$1,$2,$3,$4,$5");
    expect(JSON.stringify(query.mock.calls[0][1])).not.toContain(item.email);
    expect(JSON.stringify(query.mock.calls[0][1])).not.toContain(item.trackingToken);
    await claim.finish({ status: 201, body: { ok: true, trackingToken: item.trackingToken, trackingUrl: `/requests?token=${item.trackingToken}` } });
    expect(query.mock.calls[1][1][2]).toBe(JSON.stringify({ status: 201, body: { ok: true }, leaseId: "test-lease" }));
  });

  it("propagates database failure without falling back to in-memory admission", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    query.mockRejectedValue(new Error("database offline"));
    await expect(claimLogoRequest(request(), submission())).rejects.toThrow("database offline");
  });

  it("enforces a global budget across otherwise distinct networks and recipients", async () => {
    let limited = false;
    for (let i = 1; i <= 101; i++) {
      if ((await claimLogoRequest(request(`198.51.100.${i}`), submission())).kind === "limited") { limited = true; break; }
    }
    expect(limited).toBe(true);
  });

  it("expires local quota buckets and receipts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 86400000);
    const item = submission();
    expect((await claimLogoRequest(request(), item)).kind).toBe("accepted");
    expect((await claimLogoRequest(request(), item)).kind).toBe("pending");
    vi.advanceTimersByTime(31 * 86400000);
    expect((await claimLogoRequest(request(), item)).kind).toBe("accepted");
  });

  it("reclaims only authenticated storage failures without charging the reserved quota again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 65 * 86400000);
    const item = submission();
    const first = await claimLogoRequest(request(), item);
    expect(first.kind).toBe("accepted");
    await first.releaseStorage();
    expect((await claimLogoRequest(request(), { ...item, trackingToken: "b".repeat(43) })).kind).toBe("conflict");
    expect((await claimLogoRequest(request(), { ...item, institutionName: "Changed" })).kind).toBe("conflict");
    for (let i = 0; i < 8; i++) {
      const retry = await claimLogoRequest(request(), item);
      expect(retry.kind).toBe("accepted");
      expect((await claimLogoRequest(request(), item)).kind).toBe("pending");
      await retry.releaseStorage();
    }
    const email = item.email;
    expect((await claimLogoRequest(request("192.0.7.1"), { ...submission(), email })).kind).toBe("accepted");
    expect((await claimLogoRequest(request("192.0.7.2"), { ...submission(), email })).kind).toBe("accepted");
    expect((await claimLogoRequest(request("192.0.7.3"), { ...submission(), email })).kind).toBe("limited");
  });

  it("recovers a hard-killed storage owner without releaseStorage and fences stale delivery", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 100 * 86400000);
    const item = submission();
    const abandoned = await claimLogoRequest(request(), item);
    expect(abandoned.kind).toBe("accepted");
    // Model an outage where neither persistence nor the failure marker succeeded.
    expect((await claimLogoRequest(request(), item)).kind).toBe("pending");
    vi.advanceTimersByTime(59000);
    expect((await claimLogoRequest(request(), item)).kind).toBe("pending");
    vi.advanceTimersByTime(2000);
    const recovered = await claimLogoRequest(request(), item);
    expect(recovered.kind).toBe("accepted");
    expect(recovered.leaseId).not.toBe(abandoned.leaseId);
    await expect(abandoned.beginDelivery()).rejects.toThrow("expired");
    await expect(abandoned.releaseStorage()).rejects.toThrow("ownership");
    await expect(abandoned.finish({ status: 201, body: { ok: true } })).rejects.toThrow("ownership");
    await recovered.beginDelivery();
    vi.advanceTimersByTime(86400000);
    // Once delivery starts, timeout/lease expiry cannot authorize a duplicate send.
    expect((await claimLogoRequest(request(), item)).kind).toBe("pending");
    await recovered.finish({ status: 202, body: { ok: true, emailDelivered: true } });
    const completed = await claimLogoRequest(request(), item);
    expect(completed.kind).toBe("retry");
    expect(completed.reply).toEqual({ status: 202, body: { ok: true, emailDelivered: true } });
  });

  it("requires a durable owner-checked storage-to-delivery transition", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    query.mockResolvedValueOnce({ rows: [{ decision: { kind: "accepted", leaseId: "owner" } }] })
      .mockResolvedValueOnce({ rows: [] });
    const claim = await claimLogoRequest(request(), submission());
    await expect(claim.beginDelivery()).rejects.toThrow("expired");
    expect(query.mock.calls[1][0]).toContain("reply->>'phase'='storage'");
    expect(query.mock.calls[1][0]).toContain("reply->>'leaseId'=$3");
    expect(query.mock.calls[1][1][2]).toBe("owner");
  });
});
