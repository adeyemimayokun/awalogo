import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/import-flags.mjs <unpacked flag-icons package directory>");
const info = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
if (info.name !== "flag-icons" || info.version !== "7.6.0" || info.license !== "MIT") throw new Error("Expected flag-icons@7.6.0 (MIT)");
const rows = JSON.parse(await readFile(join(source, "country.json"), "utf8"));
const output = join(root, "apps/web/public/flags/v1");
await mkdir(join(output, "assets"), { recursive: true });
await mkdir(join(root, "apps/web/src/generated"), { recursive: true });
const license = await readFile(join(source, "LICENSE"), "utf8");
await writeFile(join(output, "LICENSE.txt"), license);
const countries = [];
for (const row of rows.filter((row) => row.iso).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
  if (!/^[a-z]{2}$/.test(row.code)) throw new Error("Invalid country code");
  const variants = [];
  for (const ratio of ["4x3", "1x1"]) {
    const svg = await readFile(join(source, "flags", ratio, `${row.code}.svg`));
    const text = svg.toString("utf8");
    if (!/<svg\b[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/.test(text) || !/viewBox=/.test(text) || /<script\b|<foreignObject\b|\son\w+\s*=|(?:href|src)\s*=\s*["'](?!#)/i.test(text)) throw new Error(`Unsafe SVG: ${row.code}/${ratio}`);
    const formats = [];
    for (const type of ["svg", "png", "webp"]) {
      const image = sharp(svg).resize({ width: 640, height: 480, fit: "inside" });
      const bytes = type === "svg" ? svg : type === "png" ? await image.png({ compressionLevel: 9 }).toBuffer() : await image.webp({ lossless: true, effort: 3 }).toBuffer();
      const checksum = createHash("sha256").update(bytes).digest("hex");
      const metadata = await sharp(bytes).metadata();
      const url = `/flags/v1/assets/${checksum}.${type}`;
      await writeFile(join(root, "apps/web/public", url), bytes);
      formats.push({ type, url, checksum, mime_type: type === "svg" ? "image/svg+xml" : `image/${type}`, width: metadata.width, height: metadata.height });
    }
    variants.push({ id: ratio, name: ratio === "4x3" ? "4:3 rectangular" : "Square", formats });
  }
  countries.push({ code: row.code.toUpperCase(), name: row.name, region: row.continent || "Other territories", variants });
}
await writeFile(join(root, "apps/web/src/generated/flags.json"), `${JSON.stringify({ schema_version: 1, source: "https://github.com/lipis/flag-icons", version: info.version, license: "MIT", countries }, null, 2)}\n`);
console.log(`Imported ${countries.length} country and territory flags with SVG, PNG, and WebP variants.`);
