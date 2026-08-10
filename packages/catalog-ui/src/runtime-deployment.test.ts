import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("runtime catalog deployment", () => {
  it("stays within the Vercel Hobby plan function limit", async () => {
    const apiRoot = resolve(process.cwd(), "api");
    const routes = (await readdir(apiRoot, { recursive: true }))
      .filter((path) => /\.(?:js|ts)$/.test(path))
      .filter((path) => !path.split("/").some((segment) => segment.startsWith("_")));

    expect(routes).toHaveLength(12);
    expect(routes.some((path) => path.endsWith(".test.ts"))).toBe(false);
  });

  it("serves catalog files with public CORS and appropriate cache policies", async () => {
    const config = JSON.parse(await readFile(resolve(process.cwd(), "vercel.json"), "utf8"));
    const catalog = config.headers.find((entry: { source: string }) => entry.source === "/catalog/v1/catalog.json");
    const assets = config.headers.find((entry: { source: string }) => entry.source === "/catalog/v1/assets/:path*");

    expect(catalog.headers).toContainEqual({ key: "Access-Control-Allow-Origin", value: "*" });
    expect(catalog.headers).toContainEqual({ key: "Access-Control-Allow-Headers", value: "If-None-Match" });
    expect(catalog.headers).toContainEqual({ key: "Access-Control-Expose-Headers", value: "ETag" });
    expect(catalog.headers.find((header: { key: string }) => header.key === "Cache-Control").value).toContain("s-maxage=300");
    expect(assets.headers).toContainEqual({ key: "Access-Control-Allow-Origin", value: "*" });
    expect(assets.headers.find((header: { key: string }) => header.key === "Cache-Control").value).toContain("immutable");
  });
});
