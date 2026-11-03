import type { VercelRequest, VercelResponse } from "./vercel-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markRepositoryNotificationRead } from "./github";
import notifications from "../admin/notifications";
import requests from "../admin/requests";

const originalEnvironment = { ...process.env };

describe("repository notification authorization", () => {
  beforeEach(() => {
    process.env.VERCEL = "1";
    process.env.GITHUB_REPOSITORY = "maintainer/awalogo";
  });
  afterEach(() => {
    process.env = { ...originalEnvironment };
    vi.unstubAllGlobals();
  });

  it("checks repository membership with the same credential before mutating", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ id: "123", repository: { full_name: "Maintainer/Awalogo" } }))
      .mockResolvedValueOnce(new Response(null, { status: 205 }));
    vi.stubGlobal("fetch", fetcher);
    await markRepositoryNotificationRead("123", "test-session-token");
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toBe("https://api.github.com/notifications/threads/123");
      expect(init.headers.Authorization).toBe("Bearer test-session-token");
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
    expect(fetcher.mock.calls[1][1].method).toBe("PATCH");
  });

  it("refuses an out-of-repository thread without PATCHing", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "123", repository: { full_name: "maintainer/another-repo" } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(markRepositoryNotificationRead("123", "test-session-token")).rejects.toThrow("does not belong");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed IDs before contacting GitHub", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const id of ["", "../123", "1?other=true", "9".repeat(31)]) {
      await expect(markRepositoryNotificationRead(id, "test-session-token")).rejects.toThrow("Invalid notification");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("admin mutation origins", () => {
  it("rejects cross-origin and missing-origin mutations before authentication or side effects", async () => {
    for (const handler of [notifications, requests]) {
      for (const origin of [undefined, "https://attacker.example"]) {
        const result = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await handler({ method: "PATCH", headers: { host: "www.awalogo.com", origin }, query: {} } as VercelRequest, result as unknown as VercelResponse);
        expect(result.status).toHaveBeenCalledWith(403);
        expect(result.json).toHaveBeenCalledWith({ error: "Invalid request origin" });
      }
    }
  });
});
