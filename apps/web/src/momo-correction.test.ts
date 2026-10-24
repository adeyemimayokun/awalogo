import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { logos as legacy } from "../../../packages/catalog-ui/src/logo-data";
import { correctionBySlug, logos } from "./v2-brand-data";
import { filterBrands } from "./brand-filters";

describe("approved V2 MoMo asset correction", () => {
  it("keeps one identity and all unrelated legacy records unchanged", () => {
    const slug="momo-payment-service-bank";
    expect(logos.filter((item)=>item.slug===slug)).toHaveLength(1);
    for(const item of legacy.filter((item)=>!correctionBySlug.has(item.slug))) expect(logos.find((logo)=>logo.slug===item.slug)).toBe(item);
    const before=legacy.find((item)=>item.slug===slug)!;
    const after=logos.find((item)=>item.slug===slug)!;
    expect(before.formats[0].checksum).toBe("6792313f8af9b4d07bcf0988b687d8fca8d0976d5c2a1a4ec6ede0a0a68674cf");
    expect(after.formats[0].checksum).not.toBe(before.formats[0].checksum);
    expect(after.name).toBe(before.name);
    expect(after.category).toBe(before.category);
    expect(after.aliases).toEqual(before.aliases);
    expect(after.website).toBe("https://www.momo.ng/");
    expect(filterBrands(logos,[],"MTN MoMo").map((item)=>item.slug)).toContain(slug);
  });
  it("serves the official PSB artwork to previews, persisted PNG/WebP bags, downloads and code", () => {
    const correction=correctionBySlug.get("momo-payment-service-bank")!;
    const logo=logos.find((item)=>item.slug===correction.slug)!;
    expect(correction.preview_background).toBe("dark");
    expect(correction.source_url).toContain("www.momo.ng/wp-content/uploads/2024/10/logo-yellow-1.png");
    expect(logo.formats.map((asset)=>asset.type)).toEqual(["png","webp"]);
    for(const asset of logo.formats) {
      expect(logo.asset_urls[asset.type]).toBe(asset.url);
      expect(asset.url).toMatch(/^\/catalog\/v2\/assets\//);
      expect(createHash("sha256").update(readFileSync(`apps/web/public${asset.url}`)).digest("hex")).toBe(asset.checksum);
    }
  });
});
