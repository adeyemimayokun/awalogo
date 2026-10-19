import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { logos as existing } from "../../../packages/catalog-ui/src/logo-data";
import campaign from "../../../packages/brands/research/candidates.json";
import research from "../../../packages/brands/research/manifest.json";
import reviews from "../../../packages/brands/research/reviews.json";
import { expansionBrandSchema } from "../../../packages/brands/schema";
import { correctionBySlug, expansionBrands, logos, matchesBrandScope } from "./v2-brand-data";

describe("isolated V2 company expansion", () => {
  it("protects the original catalog and every asset byte", () => {
    expect(execFileSync(process.execPath, ["scripts/brands-baseline.mjs"], { encoding: "utf8" })).toContain("1703");
    expect([...correctionBySlug.keys()]).toEqual(["momo-payment-service-bank", "sparkle-microfinance-bank", "nomba", "ratefy", "connectpoint-technology-solutions"]);
    expect(logos.slice(0, existing.length).filter((item)=>!correctionBySlug.has(item.slug))).toEqual(existing.filter((item)=>!correctionBySlug.has(item.slug)));
    expect(logos.length).toBe(existing.length + expansionBrands.length);
  });
  it("researches exactly 60 Nigerian and five companies in each of eight hubs", () => {
    expect(campaign).toHaveLength(100);
    expect(research.entries.length).toBeGreaterThanOrEqual(100);
    for (const [name] of campaign) expect(research.entries.some((entry) => entry.name === name)).toBe(true);
    expect(campaign.filter((entry) => entry[2] === "NG")).toHaveLength(60);
    for (const code of ["ZA", "KE", "GH", "EG", "MA", "CI", "SN", "TZ"]) expect(campaign.filter((entry) => entry[2] === code)).toHaveLength(5);
    expect(new Set(campaign.filter((entry) => entry[2] === "NG").map((entry) => entry[1])).size).toBe(12);
  });
  it("publishes reviewed candidates only in bounded batches", () => {
    for (const brand of expansionBrands) {
      expect(reviews.find((review) => review.slug === brand.slug)?.decision).toBe("approved");
      expect(existing.some((legacy) => legacy.slug === brand.slug)).toBe(false);
      expect(brand.evidence.length).toBeGreaterThan(0);
      expect(expansionBrands.filter((item) => item.batch === brand.batch).length).toBeLessThanOrEqual(25);
    }
  });
  it("verifies downloadable bytes, safe asset paths and raster-only availability", () => {
    for (const brand of expansionBrands) for (const asset of brand.formats) {
      expect(asset.url).toMatch(/^\/catalog\/v2\/assets\/[a-f0-9]{64}\.(svg|png|webp)$/);
      const bytes = readFileSync(`apps/web/public${asset.url}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.checksum);
    }
    expect(expansionBrands.find((brand) => brand.slug === "ipnx")?.formats.some((asset) => asset.type === "svg")).toBe(false);
  });
  it("never marks community artwork officially verified", () => {
    expect(expansionBrandSchema.safeParse({ ...expansionBrands[0], source_type: "community-catalog", status: "verified" }).success).toBe(false);
    expect(expansionBrandSchema.safeParse({ ...expansionBrands[0], source_type: "community-catalog", status: "needs-review" }).success).toBe(true);
  });
  it("rejects unsafe sources and altered asset metadata", () => {
    expect(expansionBrandSchema.safeParse({ ...expansionBrands[0], website: "javascript:alert(1)" }).success).toBe(false);
    const formats = expansionBrands[0].formats.map((asset) => ({ ...asset, checksum: "0".repeat(64) }));
    expect(expansionBrandSchema.safeParse({ ...expansionBrands[0], formats }).success).toBe(false);
  });
  it("filters new industries and independently evidenced markets", () => {
    expect(matchesBrandScope("seamlesshr", "technology", "KE")).toBe(true);
    expect(matchesBrandScope("seamlesshr", "healthcare", "NG")).toBe(false);
    expect(matchesBrandScope("crdb-bank", "financial-services", "TZ")).toBe(true);
    expect(matchesBrandScope(existing[0].slug, "financial-services", "NG")).toBe(true);
    expect(matchesBrandScope(existing[0].slug, "", "KE")).toBe(false);
  });
  it("includes the reviewed second batch without promoting rejected artwork", () => {
    expect(expansionBrands.filter((brand) => brand.batch === "africa-100-02")).toHaveLength(12);
    for (const slug of ["konga", "slot", "air-peace", "emzor", "royal-air-maroc", "orange-cote-d-ivoire"]) expect(expansionBrands.some((brand) => brand.slug === slug)).toBe(true);
    for (const slug of ["nasco", "discovery"]) expect(expansionBrands.some((brand) => brand.slug === slug)).toBe(false);
    expect(matchesBrandScope("konga", "retail-commerce", "NG")).toBe(true);
    expect(matchesBrandScope("vezeeta", "healthcare", "EG")).toBe(true);
    expect(matchesBrandScope("orange-cote-d-ivoire", "telecommunications", "CI")).toBe(true);
    expect(expansionBrands.find((brand) => brand.slug === "vezeeta")?.preview_background).toBe("dark");
  });
  it("recovers missing consumer brands and makes common aliases searchable", () => {
    for (const slug of ["airtel-nigeria", "globacom", "shoprite", "jumia-nigeria", "nigerian-breweries"]) expect(logos.some((brand) => brand.slug === slug)).toBe(true);
    expect(logos.find((brand) => brand.slug === "globacom")?.aliases).toContain("Glo");
    expect(logos.find((brand) => brand.slug === "airtel-nigeria")?.aliases).toContain("Airtel");
    expect(matchesBrandScope("shoprite", "retail-commerce", "NG")).toBe(true);
    expect(expansionBrands.find((brand) => brand.slug === "nigerian-breweries")?.formats.some((asset) => asset.type === "svg")).toBe(true);
    for (const slug of ["shoprite", "nigerian-breweries"]) expect(expansionBrands.find((brand) => brand.slug === slug)?.preview_background).toBe("dark");
  });
  it("adds reviewed cross-industry brands without publishing product marks as companies", () => {
    expect(expansionBrands.filter((brand) => brand.batch === "africa-cross-industry-04")).toHaveLength(17);
    for (const slug of ["altschool-africa", "oando", "egbin-power", "channels-television", "spar-nigeria", "bua-cement", "naspers", "mpharma", "swvl", "societe-ivoirienne-de-banque"]) expect(logos.some((brand) => brand.slug === slug)).toBe(true);
    expect(expansionBrands.some((brand) => brand.slug === "intouch")).toBe(false);
    expect(logos.find((brand) => brand.slug === "channels-television")?.aliases).toContain("Channels TV");
    expect(logos.find((brand) => brand.slug === "societe-ivoirienne-de-banque")?.aliases).toContain("SIB");
    expect(matchesBrandScope("altschool-africa", "education", "NG")).toBe(true);
    expect(matchesBrandScope("egbin-power", "energy-utilities", "NG")).toBe(true);
    expect(matchesBrandScope("mpharma", "healthcare", "GH")).toBe(true);
    expect(expansionBrands.find((brand) => brand.slug === "swvl")).toMatchObject({ origin_country: "EG", headquarters_country: "AE", operating_countries: ["EG"] });
    const egBinSource = research.entries.find((entry) => entry.slug === "egbin-power")!.candidate_assets[1];
    expect(expansionBrands.find((brand) => brand.slug === "egbin-power")?.formats[0].repository_path).toBe(`assets/${egBinSource.checksum}.png`);
  });
});
