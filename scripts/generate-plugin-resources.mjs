import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

// Reuse the reviewed renderer so generated PNG/WebP bytes match the catalog.
await import("./publish-brands.mjs");

const root = resolve(import.meta.dirname, "..");
const publicRoot = resolve(root, "apps/web/public");
const read = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const { brands } = await read("packages/brands/catalog.json");
const { variations } = await read("packages/brands/historical-catalog.json");
const { countries, source, version } = await read("apps/web/src/generated/flags.json");
const output = resolve(publicRoot, "catalog/plugin/v2");
await mkdir(resolve(output, "assets"), { recursive: true });
await copyFile(resolve(publicRoot, "flags/v1/LICENSE.txt"), resolve(output, "LICENSE-flags.txt"));

async function formatsFor(formats) {
  return Promise.all(formats.map(async (asset) => {
    if (!/^\/(catalog\/v2|flags\/v1)\/assets\/[a-f0-9]{64}\.(svg|png|webp|jpg)$/.test(asset.url)) throw new Error("Unexpected plugin resource path");
    const filename = asset.url.split("/").at(-1);
    const path = resolve(publicRoot, `.${asset.url}`);
    const bytes = await readFile(path);
    if (createHash("sha256").update(bytes).digest("hex") !== asset.checksum) throw new Error(`Checksum mismatch: ${asset.url}`);
    await copyFile(path, resolve(output, "assets", filename));
    return { ...asset, repository_path: `assets/${filename}`, url: `/catalog/plugin/v2/assets/${filename}` };
  }));
}
const items = [];
for (const brand of brands) {
  items.push({
    kind: "company", categories: [brand.industry],
    logo: { name: brand.name, slug: brand.slug, category: brand.industry, aliases: brand.aliases,
      website: brand.website, source_url: brand.source_url, source_type: brand.source_type,
      status: brand.status, added_at: brand.added_at, updated_at: brand.updated_at,
      formats: await formatsFor(brand.formats), preview_background: brand.preview_background,
      variations: await Promise.all(variations.filter((item) => item.slug === brand.slug).map(async (item) => ({
        id: item.id, name: item.name, status: "old", source_url: item.source_url, formats: await formatsFor(item.formats)
      }))) }
  });
}
for (const flag of countries) {
  const primary = flag.variants[0];
  items.push({
    kind: "flag", categories: [flag.region],
    logo: { name: `${flag.name} flag`, slug: `flag-${flag.code.toLowerCase()}`, category: flag.region,
      aliases: [flag.code, flag.name], website: source, source_url: source, source_type: `flag-icons ${version} (MIT)`,
      status: "needs-review", added_at: "2026-10-18", updated_at: "2026-10-18",
      formats: await formatsFor(primary.formats),
      variations: await Promise.all(flag.variants.slice(1).map(async (item) => ({ id: item.id, name: item.name, status: "active", formats: await formatsFor(item.formats) }))) }
  });
}
await writeFile(resolve(output, "index.json"), JSON.stringify({ schema_version: 2, items }));
console.log(`Plugin resource supplement: ${brands.length} companies, ${countries.length} flags. V1 untouched.`);
