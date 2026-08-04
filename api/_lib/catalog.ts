import { createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import {
  institutionCategorySchema,
  logoCatalogSchema,
  logoEntrySchema,
  logoVariationSchema
} from "./catalog-schema.js";
import type { FileChange } from "./github.js";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const svgUpload = z.string().min(20).max(1_500_000);
const mutationBase = z.object({ operation: z.string() });
const stagedVariationSchema = z.object({
  id: slug,
  name: z.string().trim().min(2).max(80),
  sourceUrl: z.string().url().optional(),
  svgBase64: svgUpload
});

export const mutationSchema = z.discriminatedUnion("operation", [
  mutationBase.extend({
    operation: z.literal("add-logo"),
    name: z.string().trim().min(2).max(100),
    slug,
    categories: z.array(institutionCategorySchema).min(1).max(12),
    aliases: z.array(z.string().trim().min(1).max(100)).max(20),
    website: z.string().url(),
    sourceUrl: z.string().url().optional(),
    sourceType: z.enum(["official-brand-page", "official-website", "annual-report", "verified-pdf", "other-official", "community-catalog"]),
    svgBase64: svgUpload,
    variations: z.array(stagedVariationSchema).max(12).default([])
  }),
  mutationBase.extend({ operation: z.literal("remove-logo"), slug, confirmation: z.string() }),
  mutationBase.extend({
    operation: z.literal("replace-logo"),
    slug,
    sourceUrl: z.string().url(),
    sourceType: z.enum(["official-brand-page", "official-website", "annual-report", "verified-pdf", "other-official"]),
    svgBase64: svgUpload
  }),
  mutationBase.extend({
    operation: z.literal("add-variation"),
    slug,
    variationId: slug,
    name: z.string().trim().min(2).max(80),
    sourceUrl: z.string().url(),
    svgBase64: svgUpload
  }),
  mutationBase.extend({ operation: z.literal("remove-variation"), slug, variationId: slug, confirmation: z.string() })
]).superRefine((mutation, context) => {
  if (mutation.operation !== "add-logo") return;
  const variationIds = mutation.variations.map((variation) => variation.id);
  if (new Set(variationIds).size !== variationIds.length) {
    context.addIssue({ code: "custom", path: ["variations"], message: "Variation IDs must be unique" });
  }
  const encodedSize = mutation.svgBase64.length + mutation.variations.reduce((total, variation) => total + variation.svgBase64.length, 0);
  if (encodedSize > 3_500_000) {
    context.addIssue({ code: "custom", path: ["variations"], message: "Primary logo and variations must be under 3.5 MB combined" });
  }
});

export type CatalogMutation = z.infer<typeof mutationSchema>;
type LogoEntry = z.infer<typeof logoEntrySchema>;
type LogoVariation = z.infer<typeof logoVariationSchema>;
type Variations = Record<string, LogoVariation[]>;
type FormatManifest = { version: number; render_settings: unknown; source_sha256: Record<string, string> };

const CORE_LOGO_SLUGS = ["moniepoint", "opay", "flutterwave"] as const;

const ROOT = "packages/logos/src/";
const CATALOG_PATH = `${ROOT}promoted-catalog.json`;
const VARIATIONS_PATH = `${ROOT}variations.json`;
const MANIFEST_PATH = `${ROOT}formats-manifest.json`;

function prettyJson(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function decodeSvg(base64: string): Buffer {
  const value = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const buffer = Buffer.from(value, "base64");
  const text = buffer.toString("utf8").trim();
  if (!/^<svg[\s>]/i.test(text) && !/^<\?xml[\s\S]*?<svg[\s>]/i.test(text)) throw new Error("The uploaded file is not an SVG");
  if (!/\bviewBox\s*=\s*["'][^"']+["']/i.test(text)) throw new Error("SVG must include a viewBox");
  if (/<script\b|<foreignObject\b|<!doctype\b|<!entity\b|\bon[a-z]+\s*=|javascript:|data:text\/html/i.test(text)) {
    throw new Error("SVG contains scripts or unsafe embedded content");
  }
  const externalReference = /(?:href|src)\s*=\s*["']\s*(?:https?:)?\/\//i;
  if (externalReference.test(text) || /url\s*\(\s*["']?(?:https?:)?\/\//i.test(text)) throw new Error("SVG cannot load external resources");
  return Buffer.from(text);
}

async function renderedFormats(svg: Buffer): Promise<{ png: Buffer; webp: Buffer }> {
  const pipeline = sharp(svg, { density: 300 }).resize({
    width: 1024,
    height: 1024,
    fit: "inside",
    withoutEnlargement: false
  });
  const [png, webp] = await Promise.all([
    pipeline.clone().png({ compressionLevel: 9, palette: true }).toBuffer(),
    pipeline.clone().webp({ lossless: true, effort: 6 }).toBuffer()
  ]);
  return { png, webp };
}

function formats(fileStem: string) {
  return [
    { type: "svg" as const, path: `assets/${fileStem}.svg`, mime_type: "image/svg+xml" as const, width: null, height: null },
    { type: "png" as const, path: `assets/${fileStem}.png`, mime_type: "image/png" as const, width: null, height: null },
    { type: "webp" as const, path: `assets/${fileStem}.webp`, mime_type: "image/webp" as const, width: null, height: null }
  ];
}

function legacyLogoCategory(categories: string[]): "commercial-bank" | "microfinance-bank" | "merchant-bank" | "payment-bank" | "fintech" | "other" {
  if (categories.includes("commercial-bank")) return "commercial-bank";
  if (categories.includes("microfinance-bank")) return "microfinance-bank";
  if (categories.includes("merchant-bank")) return "merchant-bank";
  if (categories.includes("payment-service-bank")) return "payment-bank";
  if (categories.some((category) => [
    "fintech", "crypto-vasp", "digital-lender", "mobile-money-operator",
    "finance-app", "crowdfunding-platform", "robo-adviser", "digital-broker"
  ].includes(category))) return "fintech";
  return "other";
}

function fileChanges(fileStem: string, svg: Buffer, png: Buffer, webp: Buffer): FileChange[] {
  return [
    { path: `${ROOT}sources/${fileStem}.svg`, content: svg },
    { path: `${ROOT}assets/${fileStem}.svg`, content: svg },
    { path: `${ROOT}assets/${fileStem}.png`, content: png },
    { path: `${ROOT}assets/${fileStem}.webp`, content: webp }
  ];
}

function allReferencedPaths(catalog: LogoEntry[], variations: Variations): Set<string> {
  const paths = new Set<string>();
  for (const logo of catalog) {
    paths.add(logo.source_path);
    for (const format of logo.formats) paths.add(format.path);
  }
  for (const items of Object.values(variations)) {
    for (const variation of items) {
      paths.add(variation.source_path);
      for (const format of variation.formats) paths.add(format.path);
    }
  }
  return paths;
}

function deletionChanges(paths: string[], references: Set<string>): FileChange[] {
  return [...new Set(paths)].filter((path) => !references.has(path)).map((path) => ({ path: `${ROOT}${path}`, content: null }));
}

function variationPaths(variation: LogoVariation): string[] {
  return [variation.source_path, ...variation.formats.map((format) => format.path)];
}

function canonicalizeManifestHashes(manifest: FormatManifest, catalog: LogoEntry[], variations: Variations): void {
  const ordered: Record<string, string> = {};
  const appendLogo = (logoSlug: string) => {
    const logoHash = manifest.source_sha256[logoSlug];
    if (logoHash) ordered[logoSlug] = logoHash;
    for (const variation of variations[logoSlug] ?? []) {
      const key = `${logoSlug}/${variation.id}`;
      const variationHash = manifest.source_sha256[key];
      if (variationHash) ordered[key] = variationHash;
    }
  };

  CORE_LOGO_SLUGS.forEach(appendLogo);
  catalog.forEach((entry) => appendLogo(entry.slug));
  manifest.source_sha256 = ordered;
}

export async function buildMutationChanges(
  mutation: CatalogMutation,
  inputCatalog: unknown,
  inputVariations: unknown,
  inputManifest: FormatManifest
): Promise<{ changes: FileChange[]; title: string; body: string }> {
  const catalog = logoCatalogSchema.parse(inputCatalog);
  const variations = z.record(z.array(logoVariationSchema)).parse(inputVariations);
  const manifest = structuredClone(inputManifest);
  const today = new Date().toISOString().slice(0, 10);
  const changes: FileChange[] = [];

  if (mutation.operation === "add-logo") {
    if (catalog.some((entry) => entry.slug === mutation.slug)) throw new Error(`Logo "${mutation.slug}" already exists`);
    if (variations[mutation.slug]?.length) throw new Error(`Variation metadata for "${mutation.slug}" already exists`);
    if (mutation.sourceType !== "community-catalog" && !mutation.sourceUrl) {
      throw new Error("An official source URL is required for official logo sources");
    }
    const svg = decodeSvg(mutation.svgBase64);
    const rendered = await renderedFormats(svg);
    const entry = logoEntrySchema.parse({
      name: mutation.name,
      slug: mutation.slug,
      category: legacyLogoCategory(mutation.categories),
      categories: mutation.categories,
      aliases: mutation.aliases,
      website: mutation.website,
      source_url: mutation.sourceUrl ?? mutation.website,
      source_type: mutation.sourceType,
      source_path: `sources/${mutation.slug}.svg`,
      svg_path: `assets/${mutation.slug}.svg`,
      formats: formats(mutation.slug),
      added_at: today,
      updated_at: today,
      status: "needs-review"
    });
    catalog.push(entry);
    catalog.sort((a, b) => a.name.localeCompare(b.name));
    manifest.source_sha256[mutation.slug] = createHash("sha256").update(svg).digest("hex");
    changes.push(...fileChanges(mutation.slug, svg, rendered.png, rendered.webp));

    const stagedVariations: LogoVariation[] = [];
    for (const variation of mutation.variations) {
      const fileStem = `${mutation.slug}-${variation.id}`;
      const variationSvg = decodeSvg(variation.svgBase64);
      const variationRendered = await renderedFormats(variationSvg);
      stagedVariations.push(logoVariationSchema.parse({
        id: variation.id,
        name: variation.name,
        source_url: variation.sourceUrl ?? mutation.sourceUrl ?? mutation.website,
        source_path: `sources/${fileStem}.svg`,
        svg_path: `assets/${fileStem}.svg`,
        formats: formats(fileStem)
      }));
      manifest.source_sha256[`${mutation.slug}/${variation.id}`] = createHash("sha256").update(variationSvg).digest("hex");
      changes.push(...fileChanges(fileStem, variationSvg, variationRendered.png, variationRendered.webp));
    }
    if (stagedVariations.length) {
      stagedVariations.sort((a, b) => a.name.localeCompare(b.name));
      variations[mutation.slug] = stagedVariations;
    }
  }

  if (mutation.operation === "add-variation") {
    if (!catalog.some((entry) => entry.slug === mutation.slug) && !CORE_LOGO_SLUGS.includes(mutation.slug as typeof CORE_LOGO_SLUGS[number])) {
      throw new Error(`Logo "${mutation.slug}" does not exist`);
    }
    const existing = variations[mutation.slug] ?? [];
    if (existing.some((entry) => entry.id === mutation.variationId)) throw new Error(`Variation "${mutation.variationId}" already exists`);
    const fileStem = `${mutation.slug}-${mutation.variationId}`;
    const svg = decodeSvg(mutation.svgBase64);
    const rendered = await renderedFormats(svg);
    existing.push(logoVariationSchema.parse({
      id: mutation.variationId,
      name: mutation.name,
      source_url: mutation.sourceUrl,
      source_path: `sources/${fileStem}.svg`,
      svg_path: `assets/${fileStem}.svg`,
      formats: formats(fileStem)
    }));
    existing.sort((a, b) => a.name.localeCompare(b.name));
    variations[mutation.slug] = existing;
    const catalogEntry = catalog.find((entry) => entry.slug === mutation.slug);
    if (catalogEntry) catalogEntry.updated_at = today;
    manifest.source_sha256[`${mutation.slug}/${mutation.variationId}`] = createHash("sha256").update(svg).digest("hex");
    changes.push(...fileChanges(fileStem, svg, rendered.png, rendered.webp));
  }

  if (mutation.operation === "replace-logo") {
    const entry = catalog.find((item) => item.slug === mutation.slug);
    if (!entry) throw new Error("This logo is a locked core entry or does not exist in the managed catalog");

    const previousHash = manifest.source_sha256[mutation.slug] ?? createHash("sha256")
      .update(JSON.stringify([entry.source_path, entry.formats]))
      .digest("hex");
    const historyId = `previous-${previousHash.slice(0, 8)}`;
    const existing = variations[mutation.slug] ?? [];
    if (existing.some((variation) => variation.id === historyId)) {
      throw new Error("This primary logo version is already archived");
    }
    existing.push(logoVariationSchema.parse({
      id: historyId,
      name: "Previous logo",
      kind: "historical",
      retired_at: today,
      source_url: entry.source_url,
      source_path: entry.source_path,
      svg_path: entry.svg_path,
      formats: entry.formats
    }));
    variations[mutation.slug] = existing;
    manifest.source_sha256[`${mutation.slug}/${historyId}`] = previousHash;

    const svg = decodeSvg(mutation.svgBase64);
    const rendered = await renderedFormats(svg);
    const nextHash = createHash("sha256").update(svg).digest("hex");
    const fileStem = `${mutation.slug}-${today}-${nextHash.slice(0, 8)}`;
    entry.source_url = mutation.sourceUrl;
    entry.source_type = mutation.sourceType;
    entry.source_path = `sources/${fileStem}.svg`;
    entry.svg_path = `assets/${fileStem}.svg`;
    entry.formats = formats(fileStem);
    entry.updated_at = today;
    manifest.source_sha256[mutation.slug] = nextHash;
    changes.push(...fileChanges(fileStem, svg, rendered.png, rendered.webp));
  }

  if (mutation.operation === "remove-logo") {
    if (mutation.confirmation !== mutation.slug) throw new Error("Confirmation does not match the logo slug");
    const index = catalog.findIndex((entry) => entry.slug === mutation.slug);
    if (index < 0) throw new Error("This logo is a locked core entry or does not exist in the managed catalog");
    const [removed] = catalog.splice(index, 1);
    const removedVariations = variations[mutation.slug] ?? [];
    delete variations[mutation.slug];
    delete manifest.source_sha256[mutation.slug];
    for (const variation of removedVariations) delete manifest.source_sha256[`${mutation.slug}/${variation.id}`];
    const paths = [removed.source_path, ...removed.formats.map((format) => format.path), ...removedVariations.flatMap(variationPaths)];
    changes.push(...deletionChanges(paths, allReferencedPaths(catalog, variations)));
  }

  if (mutation.operation === "remove-variation") {
    if (mutation.confirmation !== mutation.variationId) throw new Error("Confirmation does not match the variation ID");
    const existing = variations[mutation.slug] ?? [];
    const index = existing.findIndex((entry) => entry.id === mutation.variationId);
    if (index < 0) throw new Error("Variation not found");
    const [removed] = existing.splice(index, 1);
    if (existing.length) variations[mutation.slug] = existing;
    else delete variations[mutation.slug];
    const catalogEntry = catalog.find((entry) => entry.slug === mutation.slug);
    if (catalogEntry) catalogEntry.updated_at = today;
    delete manifest.source_sha256[`${mutation.slug}/${mutation.variationId}`];
    changes.push(...deletionChanges(variationPaths(removed), allReferencedPaths(catalog, variations)));
  }

  canonicalizeManifestHashes(manifest, catalog, variations);
  changes.push(
    { path: CATALOG_PATH, content: prettyJson(catalog) },
    { path: VARIATIONS_PATH, content: prettyJson(variations) },
    { path: MANIFEST_PATH, content: prettyJson(manifest) }
  );
  const actionLabel = mutation.operation.split("-").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
  return {
    changes,
    title: `CMS: ${actionLabel} ${mutation.slug}`,
    body: `Created by the secured logo CMS.\n\n- Operation: \`${mutation.operation}\`\n- Institution: \`${mutation.slug}\`${mutation.operation === "add-logo" ? `\n- Variations: \`${mutation.variations.length}\`` : ""}${mutation.operation === "add-logo" && mutation.sourceType === "community-catalog" ? "\n- Provenance: `community-catalog` (official logo source unavailable)" : ""}${mutation.operation === "replace-logo" ? "\n- Previous primary: archived as a historical logo version" : ""}\n\nPlease verify the source classification and rendered assets before merging.`
  };
}

export const catalogPaths = { catalog: CATALOG_PATH, variations: VARIATIONS_PATH, manifest: MANIFEST_PATH };
