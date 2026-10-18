import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve("packages/brands/research/manifest.json"), "utf8"));
const slugs = process.argv.slice(2);
const layers = [];
for (const [index, selection] of slugs.entries()) {
  const [slug, assetIndex] = selection.split(":");
  const entry = manifest.entries.find((entry) => entry.slug === slug);
  const asset = entry.candidate_assets[Number(assetIndex ?? (slug === "naspers" ? 1 : 0))];
  if (!asset) throw new Error(`No candidate for ${slug}`);
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="780" height="24"><text x="8" y="17" fill="#222" font-size="14" font-family="Arial">${entry.name.replaceAll("&", "&amp;")}</text></svg>`);
  layers.push({ input: label, left: 0, top: index * 100 });
  for (const [column, background] of ["#ffffff", "#242424"].entries()) {
    const image = await sharp(resolve(root, "packages/brands", asset.path)).resize({ width: 280, height: 58, fit: "inside" }).png().toBuffer();
    const { width, height } = await sharp(image).metadata();
    const tile = await sharp({ create: { width: 380, height: 72, channels: 4, background } }).composite([{ input: image, left: Math.floor((380 - width) / 2), top: Math.floor((72 - height) / 2) }]).png().toBuffer();
    layers.push({ input: tile, left: column * 390, top: index * 100 + 24 });
  }
}
await sharp({ create: { width: 780, height: slugs.length * 100, channels: 4, background: "#eee" } }).composite(layers).png().toFile("/private/tmp/awalogo-brand-review.png");
console.log("/private/tmp/awalogo-brand-review.png");
