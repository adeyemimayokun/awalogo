import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const store = vi.hoisted(() => ({ rows: new Map<string, number>(), unavailable: false }));
vi.mock("./admin-store.js", () => ({
  adminStore: vi.fn(async (path: string, init?: RequestInit) => {
    if (store.unavailable) throw new Error("private database failure");
    if (path === "rpc/revoke_admin_session") {
      const b = JSON.parse(String(init?.body));
      store.rows.set(b.session_hash, Date.parse(b.session_expiry));
      return;
    }
    const hash = new URLSearchParams(path.split("?")[1]).get("token_hash")!.slice(3);
    return store.rows.has(hash) ? [{ token_hash: hash }] : [];
  }),
}));
import { issueSession, requireAdmin, logoutSession } from "./auth";
import { adminStore } from "./admin-store.js";
import logoutHandler from "../auth/logout";
import sessionHandler from "../auth/session";
import type { VercelRequest, VercelResponse } from "./vercel-types";
function response() {
  const headers = new Map<string, unknown>();
  return { headers, code: 200, body: undefined as any,
    setHeader(k: string, v: unknown) { headers.set(k, v); return this; },
    getHeader(k: string) { return headers.get(k); },
    status(n: number) { this.code = n; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}
function request() {
  const r = response();
  issueSession(r as unknown as VercelResponse, "maintainer", "https://example.com/avatar.png", "test-github-token");
  const cookie = (r.headers.get("Set-Cookie") as string[])[0].split(";")[0];
  return { method: "GET", headers: { host: "www.awalogo.com", origin: "https://www.awalogo.com", cookie }, query: {} } as VercelRequest;
}
beforeEach(() => {
  vi.stubEnv("ADMIN_SESSION_SECRET", "test-secret-that-is-longer-than-thirty-two-characters");
  vi.stubEnv("ADMIN_GITHUB_LOGINS", "maintainer");
  vi.stubEnv("AWALOGO_LOCAL_ADMIN_BYPASS", "");
  store.rows.clear(); store.unavailable = false; vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());
describe("persistent logout revocation", () => {
  it("rejects the original copied cookie after logout across new request objects", async () => {
    const req = request();
    expect(await requireAdmin(req, response() as unknown as VercelResponse)).toMatchObject({ login: "maintainer" });
    await logoutSession(req, response() as unknown as VercelResponse);
    const res = response();
    expect(await requireAdmin({ ...req } as VercelRequest, res as unknown as VercelResponse)).toBeNull();
    expect(res.code).toBe(401);
    const status = response();
    await sessionHandler(req, status as unknown as VercelResponse);
    expect(status.code).toBe(401);
    const raw = decodeURIComponent(req.headers.cookie!.split("=")[1]);
    const persisted = JSON.stringify([...store.rows]);
    expect(persisted).not.toContain(raw);
    expect(persisted).not.toContain("test-github-token");
    expect([...store.rows.keys()][0]).toMatch(/^[a-f0-9]{64}$/);
  });
  it("does not revoke a different independent session", async () => {
    const first=request(), second=request();
    await logoutSession(first, response() as unknown as VercelResponse);
    expect(await requireAdmin(second, response() as unknown as VercelResponse)).toMatchObject({ login: "maintainer" });
  });
  it("fails closed when verification storage is unavailable", async () => {
    const req=request(), res=response(); store.unavailable=true;
    expect(await requireAdmin(req, res as unknown as VercelResponse)).toBeNull();
    expect(res.code).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("private database");
  });
  it("does not clear the cookie or claim logout succeeded on a failed revoke", async () => {
    const req={...request(),method:"POST"}, res=response(); store.unavailable=true;
    await logoutHandler(req as VercelRequest, res as unknown as VercelResponse);
    expect(res.code).toBe(503);
    expect(res.headers.has("Set-Cookie")).toBe(false);
  });
  it("does not contact storage for unauthenticated or cross-origin requests", async () => {
    const res=response();
    await requireAdmin({headers:{},query:{}} as VercelRequest,res as unknown as VercelResponse);
    expect(res.code).toBe(401);
    await logoutHandler({...request(),method:"POST",headers:{host:"www.awalogo.com",origin:"https://evil.invalid"}} as VercelRequest,response() as unknown as VercelResponse);
    expect(adminStore).not.toHaveBeenCalled();
  });
  it("enforces expiry and maintainer removal before any database lookup", async () => {
    const req=request(); vi.stubEnv("ADMIN_GITHUB_LOGINS", "another-maintainer");
    expect(await requireAdmin(req,response() as unknown as VercelResponse)).toBeNull();
    expect(adminStore).not.toHaveBeenCalled();
    vi.stubEnv("ADMIN_GITHUB_LOGINS", "maintainer");
    vi.useFakeTimers(); vi.setSystemTime(Date.now()+9*60*60*1000);
    try { expect(await requireAdmin(req,response() as unknown as VercelResponse)).toBeNull(); } finally { vi.useRealTimers(); }
  });
});
