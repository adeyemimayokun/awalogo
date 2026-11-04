import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { legacyPageUrl, v2RedirectUrl, webRoute } from "./web-route";

describe("public website versions", () => {
  it.each(["/", "/flags", "/flags/", "/about", "/requests", "/developers"])("serves V2 at %s", (path) => {
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
    expect(config.redirects).toContainEqual({ source: "/v2", destination: "/", permanent: true });
    expect(config.redirects).toContainEqual({ source: "/v2/:page(flags|about|requests|developers)", destination: "/:page", permanent: true });
    expect(config.headers.find((entry: { source: string }) => entry.source === "/requests").headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  });
  it.each([
    ["/v2", "?brand=access-bank&version=old", "#preview", "/?brand=access-bank&version=old#preview"],
    ["/v2/flags/", "?flag=ng", "#preview", "/flags?flag=ng#preview"],
    ["/v2/requests", "?token=sample", "", "/requests?token=sample"],
    ["/v2/about", "", "", "/about"],
    ["/v2/developers", "", "", "/developers"],
    ["/v2/unknown", "", "", null],
    ["/catalog/v2/assets/logo.svg", "", "", null],
  ])("canonicalizes %s without losing link state", (path, search, hash, expected) => {
    expect(v2RedirectUrl(path, search, hash)).toBe(expected);
  });
});
