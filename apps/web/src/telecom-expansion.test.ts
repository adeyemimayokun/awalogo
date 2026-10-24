import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import baseline from "../../../packages/brands/research/telecom-baseline.json";
import inventory from "../../../packages/brands/research/telecom-coverage.json";
import raw from "../../../packages/brands/catalog.json";
import { expansionBrands, logos, matchesBrandScope, operatingMarketsFor } from "./v2-brand-data";

describe("reviewed telecom expansion", () => {
  it("preserves all pre-existing V2 brand records and artwork", () => {
    const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
    for (const [slug, checksum] of Object.entries(baseline.record_hashes)) expect(hash(JSON.stringify(raw.brands.find((brand) => brand.slug === slug)))).toBe(checksum);
    for (const [url, checksum] of Object.entries(baseline.asset_hashes)) expect(hash(readFileSync(`apps/web/public${url}`))).toBe(checksum);
  });
  it("publishes reviewed official artwork and keeps unsuitable discoveries out", () => {
    expect(expansionBrands.filter((brand) => brand.batch.startsWith("telecom-africa-")).length).toBeGreaterThanOrEqual(30);
    for (const slug of ["t2-mobile", "coollink", "vdt-communications", "vodacom", "seacom", "mobilis", "telone", "qcell", "libyana"]) {
      expect(matchesBrandScope(slug, "telecommunications", "")).toBe(true);
      expect(expansionBrands.find((brand) => brand.slug === slug)?.source_type).toBe("official-website");
    }
    for (const slug of ["ntel", "djezzy", "telkom-south-africa", "eswatini-mobile"]) expect(expansionBrands.some((brand) => brand.slug === slug)).toBe(false);
    expect(logos.find((brand) => brand.slug === "t2-mobile")?.aliases).toContain("9mobile");
  });
  it("uses appropriate preview backgrounds without inventing vector files", () => {
    for (const slug of ["telecom-egypt", "telkom-kenya", "africell", "libyana"]) expect(expansionBrands.find((brand) => brand.slug === slug)?.preview_background).toBe("dark");
    expect(expansionBrands.find((brand) => brand.slug === "swift-networks")?.formats.map((asset) => asset.type)).toEqual(["png", "webp"]);
  });
  it("adds evidenced group-market coverage without duplicating existing MTN artwork", () => {
    expect(matchesBrandScope("mtn-group", "telecommunications", "NG")).toBe(true);
    expect(operatingMarketsFor("mtn-group")).toContain("ZA");
    expect(logos.find((brand) => brand.slug === "mtn-group")?.aliases).toContain("MTN Nigeria");
    expect(logos.filter((brand) => brand.slug === "mtn-group")).toHaveLength(1);
  });
  it("keeps a current, explicit available/pending/unresolved inventory", () => {
    expect(execFileSync(process.execPath, ["scripts/telecom-coverage.mjs", "--check"], { encoding: "utf8" })).toContain("available");
    expect(inventory.entries.length).toBeGreaterThan(80);
    for (const entry of inventory.entries) expect(entry.status === "available").toBe(expansionBrands.some((brand) => brand.slug === entry.slug));
  });
});
