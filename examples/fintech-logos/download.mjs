import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const catalogUrl = new URL("https://www.awalogo.com/catalog/v1/catalog.json");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function bundleLogos(mapping, output, fetcher = fetch) {
  async function download(url) {
    const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Download failed: ${url.pathname} (HTTP ${response.status})`);
    return response;
  }

  const catalog = await (await download(catalogUrl)).json();
  if (catalog.schema_version !== 1 || !Array.isArray(catalog.items)) {
    throw new Error("Unsupported catalog schema");
  }
  const bySlug = new Map(catalog.items.filter((item) => item.logo).map(({ logo }) => [logo.slug, logo]));
  const assets = new Map();
  const logos = Object.create(null);
  for (const [id, slug] of Object.entries(mapping)) {
    const logo = bySlug.get(slug);
    if (!logo) throw new Error(`Missing logo slug: ${slug}`);
    const asset = logo.formats.find(({ type }) => type === "svg") ?? logo.formats.find(({ type }) => type === "png");
    if (!asset || !/^[a-f0-9]{64}$/.test(asset.checksum)) throw new Error(`No supported asset for ${slug}`);
    const url = new URL(asset.url, catalogUrl);
    if (url.origin !== catalogUrl.origin || !url.pathname.startsWith("/catalog/v1/assets/")) {
      throw new Error(`Unexpected asset URL for ${slug}`);
    }
    const file = `${asset.checksum}.${asset.type}`;
    if (!assets.has(file)) {
      const bytes = Buffer.from(await (await download(url)).arrayBuffer());
      if (digest(bytes) !== asset.checksum) throw new Error(`Checksum mismatch for ${slug}`);
      assets.set(file, bytes);
    }
    logos[id] = { slug, name: logo.name, file, checksum: asset.checksum };
  }

  await mkdir(output, { recursive: true });
  async function writeAtomic(name, content) {
    const temp = join(output, `.${randomUUID()}.tmp`);
    try {
      await writeFile(temp, content, { flag: "wx" });
      await rename(temp, join(output, name));
    } finally {
      await rm(temp, { force: true });
    }
  }
  // Write verified, content-addressed assets first; commit the manifest last.
  for (const [file, bytes] of assets) await writeAtomic(file, bytes);
  const manifest = { schema_version: 1, catalog_version: catalog.catalog_version, logos };
  await writeAtomic("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const mapping = JSON.parse(await readFile(new URL("./mapping.json", import.meta.url), "utf8"));
    const output = process.argv[2] ?? "./public/logos";
    const manifest = await bundleLogos(mapping, output);
    console.log(`Bundled ${Object.keys(manifest.logos).length} logos into ${output}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
