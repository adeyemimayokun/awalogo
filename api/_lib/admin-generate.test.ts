import { readFile } from "node:fs/promises";
import { describe, it, expect, vi, afterEach } from "vitest";
import { generateAdminOutputs } from "./admin-generate";
import reviews from "../../packages/brands/research/reviews.json";
import manifest from "../../packages/brands/research/manifest.json";
afterEach(() => vi.unstubAllEnvs());
describe("admin generated artifacts", () => {
  for (const format of ["svg", "png", "webp"])
    it(`matches the publisher byte-for-byte for unchanged ${format} source`, async () => {
      vi.stubEnv("AWALOGO_LOCAL_ADMIN_BYPASS", "1");
      vi.stubEnv("VERCEL", "");
      const review = reviews.find(
        (r) =>
          r.decision === "approved" &&
          manifest.entries
            .find((e) => e.slug === r.slug)
            ?.candidate_assets.some(
              (a) => a.path === r.asset_path && a.format === format,
            ),
      )!;
      expect(review).toBeTruthy();
      const path = "packages/brands/research/reviews.json";
      const changes = await generateAdminOutputs(
        [{ path, content: await readFile(path) }],
        review.slug,
      );
      for (const change of changes) {
        const existing = await readFile(change.path);
        expect(change.content?.equals(existing), change.path).toBe(true);
      }
    });
  it("matches historical public files and metadata exactly", async () => {
    vi.stubEnv("AWALOGO_LOCAL_ADMIN_BYPASS", "1");
    vi.stubEnv("VERCEL", "");
    const path = "packages/brands/research/historical-assets.json";
    const changes = await generateAdminOutputs(
      [{ path, content: await readFile(path) }],
      "t2-mobile",
    );
    for (const change of changes)
      expect(
        change.content?.equals(await readFile(change.path)),
        change.path,
      ).toBe(true);
  });
});

it("archives the displayed raster primary without inventing SVG or changing provenance", async () => {
  vi.stubEnv("AWALOGO_LOCAL_ADMIN_BYPASS", "1");
  vi.stubEnv("VERCEL", "");
  const { prepareResourceMutation } = await import(
    "./admin-resource-mutations.js"
  );
  const sharp = (await import("sharp")).default;
  const catalog = JSON.parse(
    await readFile("packages/brands/catalog.json", "utf8"),
  );
  const original = catalog.brands.find(
    (brand: any) => brand.formats[0].type !== "svg",
  );
  const png = await sharp({
    create: { width: 12, height: 8, channels: 4, background: "#724ca4" },
  })
    .png()
    .toBuffer();
  const result = await prepareResourceMutation(
    {
      collection: "company",
      slug: original.slug,
      operation: "replace",
      notes:
        "Review replacement artwork and retain the previous raster identity.",
      file: { type: "png", base64: png.toString("base64") },
    },
    "test-maintainer",
  );
  const history = JSON.parse(
    result.changes
      .find((c) => c.path === "packages/brands/historical-catalog.json")!
      .content!.toString(),
  );
  const archived = history.variations.find(
    (v: any) => v.slug === original.slug,
  );
  expect(archived.source_type).toBe(original.source_type);
  expect(archived.formats.every((f: any) => f.type !== "svg")).toBe(true);
  expect(
    archived.formats.every(
      (f: any) =>
        f.width <= original.formats.find((f: any) => f.type === "png").width,
    ),
  ).toBe(true);
});
