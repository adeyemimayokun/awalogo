import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const legacy = (await read("packages/catalog-ui/src/generated/runtime-catalog.json")).items.map((item) => item.logo);
const expansion = (await read("packages/brands/catalog.json")).brands;
const originalLegacy = new Map((await read("packages/logos/src/promoted-catalog.json")).map((item) => [item.slug, item]));
const corrections = await read("packages/brands/research/asset-corrections.json");
const reviews = await read("packages/brands/research/reviews.json");
const rows = [], compatibility = {};
for (const [collection, brands] of [["legacy", legacy], ["expansion", expansion]]) for (const brand of brands) {
  const primary = brand.formats[0];
  if (primary.type === "svg") continue;
  const path = collection === "expansion" ? `packages/brands/${primary.repository_path}` : originalLegacy.has(brand.slug) ? `packages/logos/src/${originalLegacy.get(brand.slug).source_path}` : null;
  const original = path ? await sharp(await readFile(path)).metadata() : null;
  const raster = brand.formats.find((asset) => asset.type === "png");
  const rendered = await sharp(await readFile(`apps/web/public${raster.url}`)).metadata();
  const upscaled = original && (rendered.width > original.width * 1.1 || rendered.height > original.height * 1.1);
  const iconSource = /favicon|logo.?mark|(?:^|[-_/])icon(?:[-_.]|$)/i.test(brand.source_url);
  if (collection === "expansion" && reviews.find((item) => item.slug === brand.slug)?.without_enlargement !== true) {
    const bytes = await readFile(path);
    compatibility[brand.slug] = createHash("sha256").update(bytes).digest("hex");
  }
  if (!upscaled && !iconSource) continue;
  const correction = corrections.find((item) => item.slug === brand.slug);
  rows.push({ slug: brand.slug, name: brand.name, collection, source_url: brand.source_url, original_dimensions: original ? [original.width, original.height] : null, published_dimensions: [rendered.width, rendered.height], flags: [upscaled ? "raster-enlarged" : null, iconSource ? "icon-source" : null].filter(Boolean), disposition: correction ? "reviewed-v2-correction" : "review-needed" });
}
const data = { scope: "Heuristic source-quality audit, not a claim that every icon or enlarged logo is incorrect. No legacy or existing expansion records are rewritten.", reviewed_at: "2026-10-19", brands_checked: legacy.length + expansion.length, entries: rows };
const file = "packages/brands/research/asset-quality-audit.json", bytes = `${JSON.stringify(data, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (await readFile(file, "utf8") !== bytes) throw new Error("Stale quality audit");
} else await writeFile(file, bytes);
// Explicit one-time snapshot preserves old published outputs while new raster sources default to native size.
if (process.argv.includes("--snapshot-compatibility")) await writeFile("packages/brands/research/raster-scale-compatibility.json", `${JSON.stringify(compatibility, null, 2)}\n`);
console.log(`Audited ${data.brands_checked} brands; ${rows.length} review flags, ${rows.filter((item) => item.disposition === "reviewed-v2-correction").length} reviewed overlays.`);
