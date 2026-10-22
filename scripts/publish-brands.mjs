import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import sharp from "sharp";
import { normalizeIdentity } from "../packages/brands/identity.mjs";
import { publishHistoricalBrands } from "./publish-historical-brands.mjs";
import { publishBrandCorrections } from "./publish-brand-corrections.mjs";
import { withoutRasterEnlargement } from "./lib/raster-quality.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(root, "packages/brands");
const check = process.argv.includes("--check");
const research = JSON.parse(await readFile(join(packageRoot, "research/manifest.json"), "utf8"));
const reviews = JSON.parse(await readFile(join(packageRoot, "research/reviews.json"), "utf8"));
const rasterCompatibility = JSON.parse(await readFile(join(packageRoot, "research/raster-scale-compatibility.json"), "utf8"));
const legacy = JSON.parse(await readFile(join(root, "packages/catalog-ui/src/generated/runtime-catalog.json"), "utf8")).items.map((item) => item.logo);
legacy.push(...JSON.parse(await readFile(join(root, "packages/logos/src/promoted-catalog.json"), "utf8")));
const normalize = normalizeIdentity;
const identities = new Set(legacy.flatMap((logo) => [logo.slug, logo.name, ...logo.aliases]).map(normalize));
const checksums = new Set(legacy.flatMap((logo) => [logo, ...(logo.variations || [])]).flatMap((logo) => logo.formats || []).map((format) => format.checksum).filter(Boolean));
const published = []; const batches = new Map();
async function output(path, bytes) {
  if (check) { const current = await readFile(path).catch(() => null); if (!current?.equals(Buffer.from(bytes))) throw new Error(`Stale expansion output: ${path}`); }
  else { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); }
}
for (const review of reviews) {
  if (review.decision !== "approved") continue;
  const entry = research.entries.find((entry) => entry.slug === review.slug);
  if (!entry || entry.duplicate_of || review.duplicate_of || entry.disposition === "duplicate" || entry.disposition === "ineligible") throw new Error(`Cannot publish unqualified candidate: ${review.slug}`);
  const aliases = review.aliases ?? entry.aliases ?? [];
  const names = [entry.slug, entry.name, ...aliases].map(normalize);
  const host = (value) => new URL(value).hostname.replace(/^www\./, "");
  if ([...legacy, ...published].some((brand) => brand.website && host(brand.website) === host(review.website || entry.website)) && !review.identity_resolution) throw new Error(`Shared company domain requires an identity resolution: ${entry.slug}`);
  if (names.some((name) => identities.has(name))) throw new Error(`Identity collision with existing brand: ${entry.slug}`);
  if (!review.reviewer || !review.reviewed_at || review.review_notes?.length < 10 || !review.evidence?.length || !review.operating_countries?.includes(entry.target_market) || review.ownership_checked !== true || review.visual_reviewed !== true) throw new Error(`Incomplete approval: ${entry.slug}`);
  for (const code of [review.origin_country, review.headquarters_country, ...review.operating_countries].filter(Boolean)) if (!/^[A-Z]{2}$/.test(code)) throw new Error("Invalid country code");
  const asset = entry.candidate_assets.find((asset) => asset.path === review.asset_path);
  if (!asset || !/^staging\/[a-z0-9-]+\.(svg|png|webp|jpeg)$/.test(asset.path)) throw new Error(`Missing staged asset: ${entry.slug}`);
  const approvedSource = `assets/${asset.checksum}.${asset.format}`;
  let source = await readFile(join(packageRoot, approvedSource)).catch(() => readFile(join(packageRoot, asset.path)));
  if (createHash("sha256").update(source).digest("hex") !== asset.checksum) throw new Error(`Staged checksum mismatch: ${entry.slug}`);
  await output(join(packageRoot, approvedSource), source);
  const sourceType = review.source_type || asset.source_type;
  if (sourceType === "community-catalog" && review.status !== "needs-review") throw new Error("Community artwork cannot be marked officially verified");
  if (asset.format === "svg") {
    const $ = load(source.toString("utf8"), { xmlMode: true });
    const svg = $("svg").first();
    if (!svg.length || $("script,foreignObject,iframe,image").length) throw new Error(`Unsafe SVG: ${entry.slug}`);
    for (const element of $("*").toArray()) for (const [key, value] of Object.entries(element.attribs || {})) if (/^on/i.test(key) || (/href|src/i.test(key) && !value.startsWith("#")) || /url\(\s*["']?(?!#)[^)]/i.test(value)) throw new Error(`Unsafe SVG reference: ${entry.slug}`);
    svg.attr("xmlns", "http://www.w3.org/2000/svg");
    source = Buffer.from($.xml(svg));
  }
  if (review.trim_padding === true && asset.format !== "svg") {
    source = await sharp(source).trim({ threshold: 4 }).png().toBuffer();
  }
  // A reviewed PNG rendering can pin lossy decoder output without changing source provenance.
  const normalized = review.raster_normalization;
  if (asset.format !== "svg" && normalized?.original_checksum === asset.checksum) {
    if (!/^assets\/[a-f0-9]{64}\.png$/.test(normalized.path)) throw new Error("Invalid normalized raster path");
    source = await readFile(join(packageRoot, normalized.path));
    if (createHash("sha256").update(source).digest("hex") !== normalized.path.slice(7, -4)) throw new Error("Normalized raster checksum mismatch");
  }
  const sourceHash = createHash("sha256").update(source).digest("hex");
  if (checksums.has(sourceHash)) throw new Error(`Duplicate artwork: ${entry.slug}`);
  checksums.add(sourceHash);
  const formats = [];
  for (const type of [...(asset.format === "svg" ? ["svg"] : []), "png", "webp"]) {
    const renderer = sharp(source, { density: 144 }).resize({ width: 1024, height: 512, fit: "inside", withoutEnlargement: withoutRasterEnlargement(review, asset, rasterCompatibility) });
    const bytes = type === "svg" ? source : type === "png" ? await renderer.png().toBuffer() : await renderer.webp({ lossless: true, effort: 3 }).toBuffer();
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const meta = await sharp(bytes).metadata();
    const url = `/catalog/v2/assets/${checksum}.${type}`;
    await output(join(root, "apps/web/public", url), bytes);
    formats.push({ type, url, checksum, mime_type: type === "svg" ? "image/svg+xml" : `image/${type}`, width: meta.width, height: meta.height, repository_path: approvedSource });
  }
  const batch = review.batch || "africa-100-01"; batches.set(batch, (batches.get(batch) || 0) + 1);
  if (batches.get(batch) > 25) throw new Error("A release batch cannot exceed 25 brands");
  names.forEach((name) => identities.add(name));
  published.push({ preview_background: review.preview_background || "light", slug: entry.slug, name: entry.name, aliases, industry: entry.industry, origin_country: review.origin_country ?? null, headquarters_country: review.headquarters_country ?? null, operating_countries: review.operating_countries, website: review.website || entry.website, source_url: asset.discovered_on, source_type: sourceType, status: sourceType === "community-catalog" ? "needs-review" : "verified", added_at: review.reviewed_at, updated_at: review.reviewed_at, reviewed_at: review.reviewed_at, reviewer: review.reviewer, review_notes: review.review_notes, evidence: review.evidence, batch, formats });
}
const result = `${JSON.stringify({ schema_version: 1, brands: published.sort((a, b) => a.slug.localeCompare(b.slug)) }, null, 2)}\n`;
await output(join(packageRoot, "catalog.json"), result);
await output(join(root, "apps/web/public/catalog/v2/brands.json"), result);
const dispositions = research.entries.map((entry) => {
  const review = reviews.find((review) => review.slug === entry.slug);
  return { ...entry, disposition: review?.decision || entry.disposition, reason: review?.review_notes || entry.reason };
});
const report = `# African Brand Expansion: ${research.entries.length} Candidates\n\nExisting logos are unchanged. ${published.length} additions approved for V2 only.\n\n| Company | Target market | Industry | Disposition | Notes | Official source |\n|---|---|---|---|---|---|\n${dispositions.map((entry) => `| ${entry.name} | ${entry.target_market} | ${entry.industry} | ${entry.disposition} | ${entry.reason.replaceAll("|", "/")} | ${entry.sources.map((source) => source.url).join(", ")} |`).join("\n")}\n`;
await output(join(packageRoot, "research/source-report.md"), report);
await publishHistoricalBrands(root, check);
await publishBrandCorrections(root, check);
console.log(`${check ? "Checked" : "Published"} ${published.length} V2-only brands; no legacy files modified.`);
