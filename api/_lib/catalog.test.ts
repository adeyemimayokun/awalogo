import { describe, expect, it } from "vitest";
import { buildMutationChanges, mutationSchema } from "./catalog.js";

const safeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#111" d="M2 2h20v20H2z"/></svg>').toString("base64");
const manifest = {
  version: 1,
  render_settings: {},
  source_sha256: {} as Record<string, string>
};

function existingLogo(name: string, slug: string) {
  return {
    name,
    slug,
    category: "fintech",
    categories: ["fintech"],
    aliases: [],
    website: `https://${slug}.example`,
    source_url: `https://${slug}.example/brand`,
    source_type: "official-website",
    source_path: `sources/${slug}.svg`,
    svg_path: `assets/${slug}.svg`,
    formats: [
      { type: "svg", path: `assets/${slug}.svg`, mime_type: "image/svg+xml", width: null, height: null },
      { type: "png", path: `assets/${slug}.png`, mime_type: "image/png", width: null, height: null },
      { type: "webp", path: `assets/${slug}.webp`, mime_type: "image/webp", width: null, height: null }
    ],
    added_at: "2026-07-01",
    updated_at: "2026-07-01",
    status: "verified"
  };
}

describe("CMS catalog mutations", () => {
  it("creates normalized source and derivative changes for a new logo", async () => {
    const result = await buildMutationChanges({
      operation: "add-logo",
      name: "Example Finance",
      slug: "example-finance",
      categories: ["fintech", "finance-app"],
      aliases: ["Example"],
      website: "https://example.com",
      sourceUrl: "https://example.com/brand",
      sourceType: "official-brand-page",
      svgBase64: safeSvg,
      variations: []
    }, [], {}, structuredClone(manifest));

    const paths = result.changes.map((change) => change.path);
    expect(paths).toContain("packages/logos/src/assets/example-finance.svg");
    expect(paths).toContain("packages/logos/src/assets/example-finance.png");
    expect(paths).toContain("packages/logos/src/assets/example-finance.webp");
    const catalog = JSON.parse(result.changes.find((change) => change.path.endsWith("promoted-catalog.json"))!.content!.toString());
    expect(catalog[0]).toMatchObject({
      slug: "example-finance",
      category: "fintech",
      categories: ["fintech", "finance-app"],
      status: "needs-review"
    });
  });

  it("adds every staged variation to the same catalog change set", async () => {
    const result = await buildMutationChanges({
      operation: "add-logo",
      name: "Variant Finance",
      slug: "variant-finance",
      categories: ["fintech"],
      aliases: [],
      website: "https://variant.example",
      sourceUrl: "https://variant.example/brand",
      sourceType: "official-brand-page",
      svgBase64: safeSvg,
      variations: [
        { id: "symbol", name: "Symbol", svgBase64: safeSvg },
        { id: "light-wordmark", name: "Light wordmark", sourceUrl: "https://variant.example/light", svgBase64: safeSvg }
      ]
    }, [], {}, structuredClone(manifest));

    const paths = result.changes.map((change) => change.path);
    expect(paths).toEqual(expect.arrayContaining([
      "packages/logos/src/assets/variant-finance-symbol.svg",
      "packages/logos/src/assets/variant-finance-symbol.png",
      "packages/logos/src/assets/variant-finance-symbol.webp",
      "packages/logos/src/assets/variant-finance-light-wordmark.svg"
    ]));
    const variations = JSON.parse(result.changes.find((change) => change.path.endsWith("variations.json"))!.content!.toString());
    expect(variations["variant-finance"]).toMatchObject([
      { id: "light-wordmark", source_url: "https://variant.example/light" },
      { id: "symbol", source_url: "https://variant.example/brand" }
    ]);
    const nextManifest = JSON.parse(result.changes.find((change) => change.path.endsWith("formats-manifest.json"))!.content!.toString());
    expect(nextManifest.source_sha256).toHaveProperty("variant-finance/symbol");
    expect(nextManifest.source_sha256).toHaveProperty("variant-finance/light-wordmark");
    expect(result.body).toContain("Variations: `2`");
  });

  it("archives the current primary before promoting a new logo version", async () => {
    const currentSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle fill="#245" cx="12" cy="12" r="10"/></svg>');
    const result = await buildMutationChanges({
      operation: "replace-logo",
      slug: "versioned-finance",
      archiveId: "previous-2026-08-04",
      archiveName: "Previous logo (2026-08-04)",
      sourceUrl: "https://versioned-finance.example/new-brand",
      sourceType: "official-brand-page",
      svgBase64: safeSvg
    }, [existingLogo("Versioned Finance", "versioned-finance")], {}, {
      ...manifest,
      source_sha256: { "versioned-finance": "old-hash" }
    }, { currentPrimarySource: currentSvg });

    const changes = new Map(result.changes.map((change) => [change.path, change.content]));
    expect(changes.get("packages/logos/src/sources/versioned-finance-previous-2026-08-04.svg")?.equals(currentSvg)).toBe(true);
    expect(changes.get("packages/logos/src/assets/versioned-finance.svg")?.equals(Buffer.from(safeSvg, "base64"))).toBe(true);

    const catalog = JSON.parse(changes.get("packages/logos/src/promoted-catalog.json")!.toString());
    expect(catalog[0]).toMatchObject({
      slug: "versioned-finance",
      source_url: "https://versioned-finance.example/new-brand",
      source_type: "official-brand-page",
      updated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      status: "needs-review"
    });
    const variations = JSON.parse(changes.get("packages/logos/src/variations.json")!.toString());
    expect(variations["versioned-finance"][0]).toMatchObject({
      id: "previous-2026-08-04",
      name: "Previous logo (2026-08-04)",
      status: "old",
      archived_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      source_url: "https://versioned-finance.example/brand"
    });
    const nextManifest = JSON.parse(changes.get("packages/logos/src/formats-manifest.json")!.toString());
    expect(nextManifest.source_sha256).toHaveProperty("versioned-finance");
    expect(nextManifest.source_sha256).toHaveProperty("versioned-finance/previous-2026-08-04");
    expect(result.body).toContain("Archived primary: `previous-2026-08-04`");
  });

  it("rejects replacement when the current primary SVG is unavailable", async () => {
    await expect(buildMutationChanges({
      operation: "replace-logo",
      slug: "versioned-finance",
      archiveId: "previous-2026-08-04",
      archiveName: "Previous logo",
      sourceUrl: "https://versioned-finance.example/brand",
      sourceType: "official-website",
      svgBase64: safeSvg
    }, [existingLogo("Versioned Finance", "versioned-finance")], {}, structuredClone(manifest))).rejects.toThrow("current primary SVG could not be loaded");
  });

  it("rejects duplicate variation IDs before processing uploads", () => {
    expect(() => mutationSchema.parse({
      operation: "add-logo",
      name: "Duplicate Finance",
      slug: "duplicate-finance",
      categories: ["fintech"],
      aliases: [],
      website: "https://duplicate.example",
      sourceUrl: "https://duplicate.example/brand",
      sourceType: "official-brand-page",
      svgBase64: safeSvg,
      variations: [
        { id: "symbol", name: "Symbol", svgBase64: safeSvg },
        { id: "symbol", name: "Second symbol", svgBase64: safeSvg }
      ]
    })).toThrow("Variation IDs must be unique");
  });

  it("rejects oversized multi-asset submissions before rendering", () => {
    const largeUpload = "A".repeat(1_500_000);
    expect(() => mutationSchema.parse({
      operation: "add-logo",
      name: "Large Finance",
      slug: "large-finance",
      categories: ["fintech"],
      aliases: [],
      website: "https://large.example",
      sourceUrl: "https://large.example/brand",
      sourceType: "official-brand-page",
      svgBase64: largeUpload,
      variations: [
        { id: "symbol", name: "Symbol", svgBase64: largeUpload },
        { id: "wordmark", name: "Wordmark", svgBase64: largeUpload }
      ]
    })).toThrow("under 3.5 MB combined");
  });

  it("writes manifest hashes in the same catalog order as the format generator", async () => {
    const inputManifest = {
      ...manifest,
      source_sha256: {
        "zulu-finance": "zulu-hash",
        flutterwave: "flutterwave-hash",
        moniepoint: "moniepoint-hash",
        opay: "opay-hash",
        "alpha-finance": "alpha-hash"
      }
    };
    const result = await buildMutationChanges({
      operation: "add-logo",
      name: "Middle Finance",
      slug: "middle-finance",
      categories: ["fintech"],
      aliases: [],
      website: "https://middle.example",
      sourceUrl: "https://middle.example/brand",
      sourceType: "official-brand-page",
      svgBase64: safeSvg,
      variations: []
    }, [existingLogo("Zulu Finance", "zulu-finance"), existingLogo("Alpha Finance", "alpha-finance")], {}, inputManifest);

    const nextManifest = JSON.parse(result.changes.find((change) => change.path.endsWith("formats-manifest.json"))!.content!.toString());
    expect(Object.keys(nextManifest.source_sha256)).toEqual([
      "moniepoint",
      "opay",
      "flutterwave",
      "alpha-finance",
      "middle-finance",
      "zulu-finance"
    ]);
  });

  it("marks a reviewed logo verified with an official source", async () => {
    const logo = {
      ...existingLogo("Reviewed Finance", "reviewed-finance"),
      source_url: "https://reviewed-finance.example",
      source_type: "community-catalog",
      status: "needs-review"
    };
    const result = await buildMutationChanges({
      operation: "verify-logo",
      slug: "reviewed-finance",
      sourceUrl: "https://reviewed-finance.example/brand",
      sourceType: "official-brand-page"
    }, [logo], {}, structuredClone(manifest));

    const catalog = JSON.parse(result.changes.find((change) => change.path.endsWith("promoted-catalog.json"))!.content!.toString());
    expect(catalog[0]).toMatchObject({
      slug: "reviewed-finance",
      source_url: "https://reviewed-finance.example/brand",
      source_type: "official-brand-page",
      status: "verified"
    });
    expect(catalog[0].updated_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.body).toContain("Official source: https://reviewed-finance.example/brand");
  });

  it("does not verify an already verified logo", async () => {
    await expect(buildMutationChanges({
      operation: "verify-logo",
      slug: "verified-finance",
      sourceUrl: "https://verified-finance.example/brand",
      sourceType: "official-website"
    }, [existingLogo("Verified Finance", "verified-finance")], {}, structuredClone(manifest))).rejects.toThrow("already verified");
  });

  it("rejects SVG files with executable content", async () => {
    const unsafe = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script></svg>').toString("base64");
    await expect(buildMutationChanges({
      operation: "add-logo",
      name: "Unsafe Finance",
      slug: "unsafe-finance",
      categories: ["fintech"],
      aliases: [],
      website: "https://example.com",
      sourceUrl: "https://example.com/brand",
      sourceType: "official-website",
      svgBase64: unsafe,
      variations: []
    }, [], {}, structuredClone(manifest))).rejects.toThrow("unsafe embedded content");
  });

  it("keeps community-supplied artwork visibly pending when no official logo source exists", async () => {
    const result = await buildMutationChanges({
      operation: "add-logo",
      name: "Community Finance",
      slug: "community-finance",
      categories: ["fintech"],
      aliases: [],
      website: "https://community.example",
      sourceType: "community-catalog",
      svgBase64: safeSvg,
      variations: []
    }, [], {}, structuredClone(manifest));

    const catalog = JSON.parse(result.changes.find((change) => change.path.endsWith("promoted-catalog.json"))!.content!.toString());
    expect(catalog[0]).toMatchObject({
      source_type: "community-catalog",
      source_url: "https://community.example",
      status: "needs-review"
    });
    expect(result.body).toContain("official logo source unavailable");
  });

  it("requires a source URL when an official source classification is selected", async () => {
    await expect(buildMutationChanges({
      operation: "add-logo",
      name: "Missing Source Finance",
      slug: "missing-source-finance",
      categories: ["fintech"],
      aliases: [],
      website: "https://example.com",
      sourceType: "official-website",
      svgBase64: safeSvg,
      variations: []
    }, [], {}, structuredClone(manifest))).rejects.toThrow("official source URL is required");
  });
});
