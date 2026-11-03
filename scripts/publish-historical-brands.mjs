import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { validateSvgSecurity } from "../packages/validator/svg-security.mjs";
import sharp from "sharp";
import { cachedPublishedFormats, renderFingerprint } from "../packages/brands/render-cache.mjs";

export async function publishHistoricalBrands(root, check) {
  const packageRoot = join(root, "packages/brands");
  const previous = JSON.parse(await readFile(join(packageRoot, "historical-catalog.json"), "utf8"));
  const reviews = JSON.parse(
    await readFile(
      join(packageRoot, "research/historical-assets.json"),
      "utf8",
    ),
  );
  async function output(path, bytes) {
    if (check) {
      const current = await readFile(path).catch(() => null);
      if (!current?.equals(Buffer.from(bytes)))
        throw new Error(`Stale historical output: ${path}`);
    } else {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    }
  }
  const variations = [];
  const identities = new Set();
  for (const review of reviews) {
    const identity = `${review.slug}:${review.id}`;
    if (identities.has(identity))
      throw new Error(`Duplicate historical variation: ${identity}`);
    identities.add(identity);
    if (
      !/^assets\/[a-z0-9-]+\.(?:svg|png|webp|jpeg|jpg)$/.test(
        review.source_path,
      ) ||
      review.visual_reviewed !== true ||
      ![
        "community-catalog",
        "official-website",
        "official-brand-page",
        "annual-report",
        "verified-pdf",
      ].includes(review.source_type) ||
      !["needs-review", "verified"].includes(review.status) ||
      (review.source_type === "community-catalog" &&
        review.status === "verified")
    )
      throw new Error(`Unreviewed historical artwork: ${identity}`);
    const source = await readFile(join(packageRoot, review.source_path));
    if (
      createHash("sha256").update(source).digest("hex") !==
      review.source_checksum
    )
      throw new Error(`Historical checksum mismatch: ${identity}`);
    const isSvg = review.source_path.endsWith(".svg");
    if (isSvg) {
      validateSvgSecurity(source);
    }
    const sourceFormat = review.source_path.split(".").at(-1);
    const cached = await cachedPublishedFormats(`historical:${identity}`, renderFingerprint("historical", review.source_checksum, sourceFormat, { withoutEnlargement: !isSvg }), previous.variations.find((row) => row.slug === review.slug && row.id === review.id)?.formats, (path) => readFile(join(root, path)));
    const formats = cached ? [...cached.formats] : [];
    if (cached) for (const item of cached.outputs) await output(join(root, item.path), item.bytes);
    for (const type of cached ? [] : [...(isSvg ? ["svg"] : []), "png", "webp"]) {
      const render = sharp(source, { density: 144 }).resize({
        width: 1024,
        height: 512,
        fit: "inside",
        ...(!isSvg ? { withoutEnlargement: true } : {}),
      });
      const bytes =
        type === "svg"
          ? source
          : type === "png"
            ? await render.png().toBuffer()
            : await render.webp({ lossless: true }).toBuffer();
      const checksum = createHash("sha256").update(bytes).digest("hex");
      const meta = await sharp(bytes).metadata();
      const url = `/catalog/v2/assets/${checksum}.${type}`;
      await output(join(root, "apps/web/public", url), bytes);
      formats.push({
        type,
        url,
        checksum,
        mime_type: type === "svg" ? "image/svg+xml" : `image/${type}`,
        width: meta.width,
        height: meta.height,
        repository_path: review.source_path,
      });
    }
    variations.push({ ...review, formats });
  }
  await output(
    join(packageRoot, "historical-catalog.json"),
    `${JSON.stringify({ variations }, null, 2)}\n`,
  );
}
