import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { safeArtwork } from "./admin-resource-mutations";
import { generateAdminOutputs } from "./admin-generate";
import { buildMutationChanges } from "./catalog";
import manifest from "../../packages/brands/research/manifest.json";
import reviews from "../../packages/brands/research/reviews.json";

const svg = (body: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`);
afterEach(() => vi.unstubAllEnvs());

describe("SVG entry point security", () => {
  it.each([
    '<s:script xmlns:s="http://www.w3.org/2000/svg">alert(1)</s:script>',
    '<g xmlns="http://www.w3.org/1999/xhtml"><script/></g>',
    '<use href="&#106;avascript:alert(1)"/>',
    '<style>@import "https://evil.example/a.css";</style>',
    '<animate attributeName="href" to="https://evil.example"/>',
    '<path style="fill:url(https://evil.example)"/>',
  ])("rejects malicious artwork through both upload paths: %s", async (body) => {
    const base64 = svg(body).toString("base64");
    await expect(safeArtwork({ base64, type: "svg" })).rejects.toThrow(/unsafe/i);
    await expect(buildMutationChanges({
      operation: "add-logo", name: "Test Logo", slug: "test-logo", categories: ["fintech"],
      aliases: [], website: "https://example.com", sourceUrl: "https://example.com/brand", sourceType: "official-website",
      svgBase64: base64, variations: [],
    }, [], {}, { version: 1, render_settings: {}, source_sha256: {} })).rejects.toThrow(/unsafe/i);
  });

  it("preserves safe CSS upload bytes", async () => {
    const bytes = svg('<style>.logo{fill:#123456}</style><path class="logo" d="M0 0h24v24H0z"/>');
    expect(await safeArtwork({ base64: bytes.toString("base64"), type: "svg" })).toEqual(bytes);
  });

  it("revalidates approved source before raw publication or rendering", async () => {
    vi.stubEnv("AWALOGO_LOCAL_ADMIN_BYPASS", "1");
    vi.stubEnv("VERCEL", "");
    const review = reviews.find((row) => row.decision === "approved" && manifest.entries.find((e) => e.slug === row.slug)?.candidate_assets.some((a) => a.path === row.asset_path && a.format === "svg"))!;
    const updated = structuredClone(manifest);
    const entry = updated.entries.find((row) => row.slug === review.slug)!;
    const asset = entry.candidate_assets.find((row) => row.path === review.asset_path)!;
    const source = svg('<s:script xmlns:s="http://www.w3.org/2000/svg"/>');
    asset.checksum = createHash("sha256").update(source).digest("hex");
    await expect(generateAdminOutputs([
      { path: "packages/brands/research/reviews.json", content: await readFile("packages/brands/research/reviews.json") },
      { path: "packages/brands/research/manifest.json", content: Buffer.from(JSON.stringify(updated)) },
      { path: `packages/brands/assets/${asset.checksum}.svg`, content: source },
    ], review.slug)).rejects.toThrow(/unsafe/i);
  });

  it("revalidates historical SVG source independently", async () => {
    const source = svg('<use href="https://evil.example/a.svg"/>');
    const row = { slug: "test-logo", id: "previous", source_path: "assets/test-logo.svg", source_checksum: createHash("sha256").update(source).digest("hex") };
    await expect(generateAdminOutputs([
      { path: "packages/brands/research/historical-assets.json", content: Buffer.from(JSON.stringify([row])) },
      { path: "packages/brands/historical-catalog.json", content: Buffer.from('{"variations":[]}') },
      { path: "packages/brands/assets/test-logo.svg", content: source },
    ], "test-logo")).rejects.toThrow(/unsafe/i);
  });
});
