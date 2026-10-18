import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { load } from "cheerio";
import sharp from "sharp";

export async function publishHistoricalBrands(root, check) {
  const packageRoot = join(root, "packages/brands");
  const reviews = JSON.parse(await readFile(join(packageRoot, "research/historical-assets.json"), "utf8"));
  async function output(path, bytes) {
    if (check) {
      const current = await readFile(path).catch(() => null);
      if (!current?.equals(Buffer.from(bytes))) throw new Error(`Stale historical output: ${path}`);
    } else { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); }
  }
  const variations = [];
  const identities = new Set();
  for (const review of reviews) {
    const identity = `${review.slug}:${review.id}`;
    if (identities.has(identity)) throw new Error(`Duplicate historical variation: ${identity}`);
    identities.add(identity);
    if (!/^assets\/[a-z0-9-]+\.svg$/.test(review.source_path) || review.visual_reviewed !== true || review.source_type !== "community-catalog" || review.status !== "needs-review") throw new Error(`Unreviewed historical artwork: ${identity}`);
    const source = await readFile(join(packageRoot, review.source_path));
    if (createHash("sha256").update(source).digest("hex") !== review.source_checksum) throw new Error(`Historical checksum mismatch: ${identity}`);
    const $ = load(source.toString(), { xmlMode: true });
    if ($("svg").length !== 1 || !$("svg").attr("viewBox") || $("script,foreignObject,iframe,image,style").length) throw new Error(`Unsafe historical SVG: ${identity}`);
    for (const element of $("*").toArray()) for (const [name, value] of Object.entries(element.attribs ?? {})) {
      if (/^on/i.test(name) || (/href|src/i.test(name) && !value.startsWith("#")) || /url\(\s*["']?(?!#)[^)]/i.test(value)) throw new Error(`Unsafe historical SVG reference: ${identity}`);
    }
    const formats = [];
    for (const type of ["svg", "png", "webp"]) {
      const render = sharp(source, { density: 144 }).resize({ width: 1024, height: 512, fit: "inside" });
      const bytes = type === "svg" ? source : type === "png" ? await render.png().toBuffer() : await render.webp({ lossless: true }).toBuffer();
      const checksum = createHash("sha256").update(bytes).digest("hex");
      const meta = await sharp(bytes).metadata();
      const url = `/catalog/v2/assets/${checksum}.${type}`;
      await output(join(root, "apps/web/public", url), bytes);
      formats.push({ type, url, checksum, mime_type: type === "svg" ? "image/svg+xml" : `image/${type}`, width: meta.width, height: meta.height, repository_path: review.source_path });
    }
    variations.push({ ...review, formats });
  }
  await output(join(packageRoot, "historical-catalog.json"), `${JSON.stringify({ variations }, null, 2)}\n`);
}
