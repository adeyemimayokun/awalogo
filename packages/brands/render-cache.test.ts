import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import catalog from "./catalog.json";
import manifest from "./research/manifest.json";
import reviews from "./research/reviews.json";
import compatibility from "./research/raster-scale-compatibility.json";
import { cachedPublishedFormats, primaryRenderOptions, renderFingerprint } from "./render-cache.mjs";

const brand = catalog.brands[0];
const review = reviews.find((row) => row.slug === brand.slug)!;
const asset = manifest.entries.find((row) => row.slug === brand.slug)!.candidate_assets.find((row) => row.path === review.asset_path)!;
const options = primaryRenderOptions(review, asset, compatibility);
const fingerprint = renderFingerprint("primary", asset.checksum, asset.format, options);
const key = `primary:${brand.slug}`;

describe("pinned published render cache", () => {
  it("reuses only checksum-verified existing output records and bytes", async () => {
    const result = await cachedPublishedFormats(key, fingerprint, brand.formats, readFile);
    expect(result?.formats).toBe(brand.formats);
    expect(result?.outputs).toHaveLength(brand.formats.length);
  });
  it.each([
    renderFingerprint("primary", "0".repeat(64), asset.format, options),
    renderFingerprint("primary", asset.checksum, asset.format, { ...options, trimPadding: !options.trimPadding }),
    renderFingerprint("primary", asset.checksum, asset.format, { ...options, withoutEnlargement: !options.withoutEnlargement }),
    renderFingerprint("primary", asset.checksum, asset.format, { ...options, normalization: "assets/changed.png" }),
    renderFingerprint("different-recipe", asset.checksum, asset.format, options),
  ])("does not reuse changed inputs/options/recipes", async (changed) => {
    const read = vi.fn();
    expect(await cachedPublishedFormats(key, changed, brand.formats, read)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
  it("does not trust changed catalog format records", async () => {
    const read = vi.fn();
    expect(await cachedPublishedFormats(key, fingerprint, brand.formats.map((row) => ({ ...row, width: 1 })), read)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
  it("fails closed for corrupt, missing, or substituted existing bytes", async () => {
    await expect(cachedPublishedFormats(key, fingerprint, brand.formats, async () => Buffer.from("corrupt"))).rejects.toThrow(/checksum mismatch/);
    await expect(cachedPublishedFormats(key, fingerprint, brand.formats, async () => null)).rejects.toThrow(/checksum mismatch/);
  });
  it("checks normalized source bytes even on cache hits", async () => {
    await expect(cachedPublishedFormats(key, fingerprint, brand.formats, async () => Buffer.from("corrupt"), `assets/${"0".repeat(64)}.png`)).rejects.toThrow(/Normalized raster checksum mismatch/);
  });
});
