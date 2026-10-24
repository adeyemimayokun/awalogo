import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { flags, findFlags, flagForSlug } from "./flags-data";

describe("country flag resources", () => {
  it("includes 249 unique country and territory codes", () => {
    expect(flags).toHaveLength(249); expect(new Set(flags.map((flag) => flag.code)).size).toBe(249);
    expect(flags.every((flag) => /^[A-Z]{2}$/.test(flag.code))).toBe(true);
  });
  it("searches country names and codes, with region filtering", () => {
    expect(findFlags("Nigeria", "Africa").map((flag) => flag.code)).toEqual(["NG"]);
    expect(findFlags("NG", "all").some((flag) => flag.code === "NG")).toBe(true);
    expect(findFlags("Nigeria", "Europe")).toEqual([]);
    expect(flagForSlug("flag-ng")?.name).toBe("Nigeria"); expect(flagForSlug("opay")).toBeUndefined();
  });
  it("keeps all variants, checksums, formats, and standalone SVGs valid", () => {
    for (const flag of flags) {
      expect(flag.variants.map((variant) => variant.id)).toEqual(["4x3", "1x1"]);
      for (const variant of flag.variants) {
        expect(variant.formats.map((asset) => asset.type)).toEqual(["svg", "png", "webp"]);
        for (const asset of variant.formats) {
          expect(asset.url).toMatch(/^\/flags\/v1\/assets\/[a-f0-9]{64}\.(svg|png|webp)$/);
          const bytes = readFileSync(join("apps/web/public", asset.url));
          expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.checksum);
          expect(asset.width).toBeGreaterThan(0); expect(asset.height).toBeGreaterThan(0);
          if (asset.type === "svg") { expect(bytes.toString()).toContain('xmlns="http://www.w3.org/2000/svg"'); expect(bytes.toString()).not.toMatch(/<script\b|<foreignObject\b|\son\w+\s*=/i); }
          if (asset.type === "png") expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
          if (asset.type === "webp") expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
        }
      }
    }
  });
  it("preserves upstream attribution", () => {
    expect(existsSync("apps/web/public/flags/v1/LICENSE.txt")).toBe(true);
    expect(readFileSync("apps/web/public/flags/v1/LICENSE.txt", "utf8")).toContain("MIT");
  });
});
