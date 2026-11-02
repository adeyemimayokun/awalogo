import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { legacyPageUrl, webRoute } from "./web-route";

describe("public website versions", () => {
  it.each(["/", "/v2", "/v2/", "/v2/flags", "/v2/about", "/v2/requests"])("serves V2 at %s", (path) => {
    expect(webRoute(path)).toBe("v2");
  });
  it.each(["/v1", "/v1/"])("keeps the original interface at %s", (path) => {
    expect(webRoute(path)).toBe("v1");
  });
  it("preserves admin, docs, and unknown-route handling", () => {
    expect(webRoute("/admin/requests")).toBe("admin");
    expect(webRoute("/docs")).toBe("docs");
    expect(webRoute("/docs/usage")).toBe("docs");
    expect(webRoute("/v10")).toBe("not-found");
    expect(webRoute("/missing")).toBe("not-found");
  });
  it("keeps existing V1 shared links and request links working", () => {
    expect(legacyPageUrl("/", "?logo=access-bank&asset=primary", "#preview")).toBe("/v1?logo=access-bank&asset=primary#preview");
    expect(legacyPageUrl("/", "?request=true")).toBe("/v1?request=true");
    expect(legacyPageUrl("/", "?new=true")).toBe("/v1?new=true");
    expect(legacyPageUrl("/", "?utm_source=newsletter")).toBeNull();
    expect(legacyPageUrl("/v1", "?logo=access-bank")).toBeNull();
    expect(legacyPageUrl("/v2", "?brand=access-bank")).toBeNull();
  });
  it("rewrites legacy pages without changing catalog endpoints", () => {
    const config = JSON.parse(readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8"));
    expect(config.rewrites).toContainEqual({ source: "/v1", destination: "/index.html" });
    expect(config.rewrites).toContainEqual({ source: "/v1/", destination: "/index.html" });
    expect(config.rewrites.some((route: { source: string }) => route.source.startsWith("/catalog"))).toBe(false);
    expect(config.headers.find((entry: { source: string }) => entry.source === "/v2/:path*").headers.some((header: { key: string }) => header.key === "X-Robots-Tag")).toBe(false);
    expect(config.headers.find((entry: { source: string }) => entry.source === "/v2/requests").headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  });
});
