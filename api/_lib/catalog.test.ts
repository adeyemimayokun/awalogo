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

  it("replaces a primary logo without overwriting its previous version", async () => {
    const logo = existingLogo("Versioned Finance", "versioned-finance");
    const inputManifest = {
      ...manifest,
      source_sha256: { "versioned-finance": "12345678previoushash" }
    };
    const result = await buildMutationChanges({
      operation: "replace-logo",
      slug: "versioned-finance",
      sourceUrl: "https://versioned-finance.example/new-brand",
      sourceType: "official-brand-page",
      svgBase64: safeSvg
    }, [logo], {}, inputManifest);

    const catalog = JSON.parse(result.changes.find((change) => change.path.endsWith("promoted-catalog.json"))!.content!.toString());
    const variations = JSON.parse(result.changes.find((change) => change.path.endsWith("variations.json"))!.content!.toString());
    const nextManifest = JSON.parse(result.changes.find((change) => change.path.endsWith("formats-manifest.json"))!.content!.toString());
    const current = catalog[0];
    const previous = variations["versioned-finance"][0];

    expect(current.source_url).toBe("https://versioned-finance.example/new-brand");
    expect(current.source_path).toMatch(/^sources\/versioned-finance-\d{4}-\d{2}-\d{2}-[a-f0-9]{8}\.svg$/);
    expect(previous).toMatchObject({
      id: "previous-12345678",
      name: "Previous logo",
      kind: "historical",
      source_path: "sources/versioned-finance.svg",
      svg_path: "assets/versioned-finance.svg"
    });
    expect(previous.retired_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(nextManifest.source_sha256["versioned-finance/previous-12345678"]).toBe("12345678previoushash");
    expect(result.changes.some((change) => change.path === "packages/logos/src/assets/versioned-finance.svg" && change.content === null)).toBe(false);
    expect(result.body).toContain("archived as a historical logo version");
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
