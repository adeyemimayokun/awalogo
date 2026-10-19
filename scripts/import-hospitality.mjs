import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const root = "packages/brands/", research = `${root}research/`, date = "2026-10-19";
const manifest = JSON.parse(await readFile(`${research}manifest.json`, "utf8"));
const reviews = JSON.parse(await readFile(`${research}reviews.json`, "utf8"));
const choices = [
  { slug: "prince-ebeano", index: 0, aliases: ["Ebeano", "Prince Ebeano Supermarket"] },
  { slug: "justrite-superstore", index: 0, aliases: ["Justrite", "Justrite Superstores"] },
  { slug: "chicken-republic", index: 0, aliases: [], identity_resolution: "Chicken Republic is a distinct restaurant brand on Food Concepts' official website. Its named header logo was reviewed; the parent Food Concepts logo is explicitly excluded." },
  { slug: "kilimanjaro-restaurants", index: 0, aliases: ["Kilimanjaro"], dark: true },
  { slug: "the-place", file: "/tmp/theplace-logo.png", artwork: "https://theplace.com.ng/dplace.png", aliases: ["The Place Nigeria"] },
  { slug: "quilox", file: "/tmp/quilox-logo.png", artwork: "https://clubquilox.com/assets/quilox-logo-GSGxLd0D.png", aliases: ["Club Quilox", "Quilox Nightclub"], dark: true },
  { slug: "eko-hotels-and-suites", index: 0, aliases: ["Eko Hotels", "Eko Hotel", "Eko Hotels & Suites"] },
  { slug: "lagos-continental", file: "/tmp/continental-logo.svg", artwork: "https://image-tc.galaxy.tf/wisvg-55mc6bhwab9ocvp1brx6w50em/lagos-continental-hotel.svg", aliases: ["Lagos Continental Hotel", "The Lagos Continental"], dark: true }
];
for (const choice of choices) {
  if (reviews.some((review) => review.slug === choice.slug)) throw new Error(`Already reviewed ${choice.slug}`);
  const entry = manifest.entries.find((candidate) => candidate.slug === choice.slug);
  if (!entry) throw new Error(`Missing candidate ${choice.slug}`);
  let asset = entry.candidate_assets[choice.index ?? 0];
  if (choice.file) {
    const bytes = await readFile(choice.file), metadata = await sharp(bytes).metadata();
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const path = `staging/${choice.slug}-reviewed-${checksum.slice(0,12)}.${metadata.format}`;
    await copyFile(choice.file, `${root}${path}`);
    asset = { path, source_url: choice.artwork, discovered_on: entry.website, source_type: "official-website", format: metadata.format, width: metadata.width, height: metadata.height, checksum, retrieved_at: date, reviewed: true };
    entry.candidate_assets.push(asset);
  }
  if (!asset) throw new Error(`Missing artwork ${choice.slug}`);
  const note = "Official brand artwork visually reviewed against the company website. Parent, payment and partner logos excluded. JavaScript and page configuration references inspected where static discovery missed the logo. Raster originals are not traced or enlarged. Official provenance does not imply a trademark redistribution licence.";
  asset.reviewed = true;
  reviews.push({ slug: choice.slug, decision: "approved", asset_path: asset.path, reviewer: "Codex assisted source and visual review", reviewed_at: date, ownership_checked: true, visual_reviewed: true, review_notes: note, origin_country: null, headquarters_country: null, operating_countries: ["NG"], preview_background: choice.dark ? "dark" : "light", evidence: [{ url: entry.website, note: "Official website establishes Nigerian retail, restaurant, nightlife or hotel operations and provides the selected brand artwork.", retrieved_at: date }], aliases: choice.aliases, ...(choice.identity_resolution ? { identity_resolution: choice.identity_resolution } : {}), source_type: "official-website", trim_padding: asset.format !== "svg", without_enlargement: true, batch: "nigerian-hospitality-2026-10-19" });
  entry.disposition = "approved";
  entry.reason = note;
}
for (const entry of manifest.entries) entry.reason = entry.reason.replace(/\s+/g, " ").trim();
manifest.summary = manifest.entries.reduce((counts, entry) => { counts[entry.disposition] = (counts[entry.disposition] ?? 0) + 1; return counts; }, {});
await writeFile(`${research}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(`${research}reviews.json`, `${JSON.stringify(reviews, null, 2)}\n`);
await copyFile("/tmp/hospitality-baseline.json", `${research}hospitality-baseline.json`);
console.log(`Reviewed ${choices.length} additions; existing records preserved.`);
