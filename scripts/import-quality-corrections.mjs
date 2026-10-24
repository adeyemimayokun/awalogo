import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const root = "packages/brands/", file = `${root}research/asset-corrections.json`;
const reviews = JSON.parse(await readFile(file, "utf8"));
const legacy = JSON.parse(await readFile("packages/catalog-ui/src/generated/runtime-catalog.json", "utf8")).items.map((item) => item.logo);
const choices = [
  { slug: "sparkle-microfinance-bank", path: "/tmp/sparkle-header-quality.png", url: "https://sparkle.ng/#embedded-header-logo", background: "light", note: "The original 160x159 footer mark was upscaled to 1024x1018 by the legacy generator. The official navigation embeds the full 603x159 PNG lockup. Extracted the original bytes, not a screenshot or traced vector; preserve V1 and apply only this reviewed V2 overlay." },
  { slug: "nomba", path: "/tmp/nomba-wordmark.png", url: "https://nomba.com/assets/7a1fa9176367d506f848c55210a5569d9989bb57.png", background: "light", note: "The existing source was a favicon. Official header artwork provides the Nomba name with its symbol at 240x56. Use the original resolution without enlargement; retain all existing identity metadata and legacy files." },
  { slug: "ratefy", path: "/tmp/ratefy-wordmark.webp", url: "https://ratefy.co/assets/ratefy-logo-BRs_H8TR.webp", background: "dark", note: "The existing source was an icon-only raster. Official header provides a 1536x600 Ratefy wordmark. Reviewed the full identity, preserved its provided background and used downsampling only; retain V1 and all unrelated records." },
  { slug: "connectpoint-technology-solutions", path: "/tmp/connectpoint-wordmark.png", url: "https://connectpoint.com.ng/wp-content/uploads/2025/07/cropped-game-removebg-preview-3.png", background: "dark", note: "The existing source was the ConnectPoint favicon. Official company header supplies a 500x149 symbol-and-name lockup with the recharge-services tagline. Visually reviewed against the same company's site; do not substitute partner logos or upscale." }
];
for (const choice of choices) {
  if (reviews.some((review) => review.slug === choice.slug)) throw new Error(`Already reviewed ${choice.slug}`);
  const current = legacy.find((item) => item.slug === choice.slug);
  if (!current) throw new Error(`Unknown legacy identity ${choice.slug}`);
  const bytes = await readFile(choice.path), metadata = await sharp(bytes).metadata();
  const checksum = createHash("sha256").update(bytes).digest("hex"), source_path = `assets/${checksum}.${metadata.format}`;
  await copyFile(choice.path, `${root}${source_path}`);
  reviews.push({ slug: choice.slug, expected_primary_checksum: current.formats[0].checksum, source_path, source_checksum: checksum, website: current.website, source_url: choice.url, preview_background: choice.background, reviewed_at: "2026-10-19", visual_reviewed: true, review_notes: choice.note });
}
await writeFile(file, `${JSON.stringify(reviews, null, 2)}\n`);
console.log(`Approved ${choices.length} V2-only full-logo corrections.`);
