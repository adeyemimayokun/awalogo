import { describe, expect, it } from "vitest";
import config from "../vercel.json";

describe("deployed security headers", () => {
  it("protects application documents without unsafe scripts or eval", () => {
    const headers = Object.fromEntries(config.headers.find((rule) => rule.source === "/(.*)")!.headers.map((h) => [h.key, h.value]));
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    const policy = headers["Content-Security-Policy"];
    expect(policy).toContain("script-src 'self';");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("unsafe-eval");
  });
  it("sandboxes public artwork while retaining plugin CORS and immutable caching", () => {
    for (const source of ["/catalog/v1/assets/:path*", "/catalog/v2/assets/:path*", "/catalog/plugin/v2/assets/:path*", "/flags/v1/assets/:path*"]) {
      const headers = Object.fromEntries(config.headers.find((rule) => rule.source === source)!.headers.map((h) => [h.key, h.value]));
      expect(headers["Access-Control-Allow-Origin"]).toBe("*");
      expect(headers["Cache-Control"]).toContain("immutable");
      expect(headers["Content-Security-Policy"]).toContain("sandbox; default-src 'none'");
      expect(headers["Content-Security-Policy"]).not.toContain("allow-scripts");
      expect(headers["Content-Security-Policy"]).not.toContain("allow-same-origin");
    }
  });
});
