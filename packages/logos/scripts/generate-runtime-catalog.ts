import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalogProjection } from "../../catalog-ui/src/catalog-projection";
import { parseRuntimeCatalog, type RuntimeAsset, type RuntimeCatalog } from "../../catalog-ui/src/runtime-catalog";
import { institutionCategories, type Institution } from "../../institutions/src";
import communityCandidatesJson from "../../institutions/data/community-candidates.json";
import foreignAuthorizedJson from "../../institutions/exports/foreign-authorized-ng.json";
import institutionsJson from "../../institutions/exports/institutions-ng.json";
import { logoCatalog } from "../src/catalog";
import { institutionLogoLinks } from "../src/institution-links";
import type { LogoFormat, LogoVariation } from "../src/schema";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDirectory, "../../..");
const logoSourceRoot = resolve(workspaceRoot, "packages/logos/src");
const generatedCatalogPath = resolve(workspaceRoot, "packages/catalog-ui/src/generated/runtime-catalog.json");
const publicCatalogRoot = resolve(workspaceRoot, "apps/web/public/catalog/v1");
const publicAssetRoot = resolve(publicCatalogRoot, "assets");
const checkOnly = process.argv.includes("--check");

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function extensionFor(format: LogoFormat) {
  if (format.type === "jpeg") return "jpg";
  const extension = extname(format.path).slice(1);
  return extension || format.type;
}

const assetCopies = new Map<string, Uint8Array>();

async function runtimeAsset(format: LogoFormat): Promise<RuntimeAsset> {
  const bytes = await readFile(resolve(logoSourceRoot, format.path));
  const checksum = sha256(bytes);
  const extension = extensionFor(format);
  const fileName = `${checksum}.${extension}`;
  assetCopies.set(fileName, bytes);
  return {
    type: format.type,
    repository_path: format.path,
    url: `/catalog/v1/assets/${fileName}`,
    mime_type: format.mime_type,
    width: format.width,
    height: format.height,
    checksum
  };
}

async function runtimeVariation(variation: LogoVariation) {
  return {
    id: variation.id,
    name: variation.name,
    ...(variation.status ? { status: variation.status } : {}),
    ...(variation.archived_at ? { archived_at: variation.archived_at } : {}),
    ...(variation.source_url ? { source_url: variation.source_url } : {}),
    formats: await Promise.all(variation.formats.map(runtimeAsset))
  };
}

async function buildRuntimeCatalog(): Promise<RuntimeCatalog> {
  assetCopies.clear();
  const runtimeLogos = await Promise.all(logoCatalog.map(async (logo) => ({
    name: logo.name,
    slug: logo.slug,
    category: logo.category,
    ...(logo.categories ? { categories: logo.categories } : {}),
    aliases: logo.aliases,
    website: logo.website,
    source_url: logo.source_url,
    source_type: logo.source_type,
    added_at: logo.added_at,
    updated_at: logo.updated_at,
    status: logo.status,
    formats: await Promise.all(logo.formats.map(runtimeAsset)),
    variations: await Promise.all((logo.variations ?? []).map(runtimeVariation))
  })));

  const institutions = [
    ...institutionsJson,
    ...foreignAuthorizedJson,
    ...communityCandidatesJson
  ] as Institution[];
  const projection = buildCatalogProjection({
    institutions,
    logos: runtimeLogos,
    institutionLogoLinks,
    institutionCategories
  });
  const items = projection.catalogItems.flatMap((item) => item.logo ? [{
    display_name: item.displayName,
    categories: item.categories,
    institutions: item.institutions,
    logo: item.logo
  }] : []);
  const publishedAt = runtimeLogos.reduce((latest, logo) => logo.updated_at > latest ? logo.updated_at : latest, "1970-01-01");
  const content = { schema_version: 1 as const, published_at: publishedAt, items };
  return parseRuntimeCatalog({
    ...content,
    catalog_version: sha256(JSON.stringify(content))
  });
}

const catalog = await buildRuntimeCatalog();
const output = stableJson(catalog);

if (checkOnly) {
  const current = await readFile(generatedCatalogPath, "utf8").catch(() => "");
  if (current !== output) {
    console.error("Generated runtime catalog is stale. Run pnpm catalog:generate.");
    process.exitCode = 1;
  } else {
    console.log(`Runtime catalog ${catalog.catalog_version.slice(0, 12)} is current (${catalog.items.length} logos).`);
  }
} else {
  await mkdir(dirname(generatedCatalogPath), { recursive: true });
  await writeFile(generatedCatalogPath, output);
  await rm(publicCatalogRoot, { recursive: true, force: true });
  await mkdir(publicAssetRoot, { recursive: true });
  await Promise.all([...assetCopies].map(([fileName, bytes]) => writeFile(resolve(publicAssetRoot, fileName), bytes)));
  await writeFile(resolve(publicCatalogRoot, "catalog.json"), output);
  console.log(`Generated runtime catalog ${catalog.catalog_version.slice(0, 12)} with ${catalog.items.length} logos and ${assetCopies.size} assets.`);
}
