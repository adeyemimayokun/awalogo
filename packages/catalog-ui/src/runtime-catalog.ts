import { z } from "zod";
import { institutionSchema } from "../../institutions/src";

const runtimeAssetSchema = z.object({
  type: z.enum(["svg", "png", "webp", "jpeg"]),
  repository_path: z.string().regex(/^assets\/[a-z0-9-]+\.(?:svg|png|webp|jpg)$/),
  url: z.string().regex(/^\/catalog\/v1\/assets\/[a-f0-9]{64}\.(?:svg|png|webp|jpg)$/),
  mime_type: z.enum(["image/svg+xml", "image/png", "image/webp", "image/jpeg"]),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/)
});

const runtimeVariationSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["active", "old"]).optional(),
  archived_at: z.string().optional(),
  source_url: z.string().url().optional(),
  formats: z.array(runtimeAssetSchema).min(1)
});

const runtimeLogoSchema = z.object({
  name: z.string(),
  slug: z.string(),
  category: z.string(),
  categories: z.array(z.string()).optional(),
  aliases: z.array(z.string()),
  website: z.string().url(),
  source_url: z.string().url(),
  source_type: z.string(),
  added_at: z.string(),
  updated_at: z.string(),
  status: z.enum(["verified", "needs-review", "deprecated"]),
  formats: z.array(runtimeAssetSchema).min(1),
  variations: z.array(runtimeVariationSchema)
});

export const runtimeCatalogSchema = z.object({
  schema_version: z.literal(1),
  catalog_version: z.string().regex(/^[a-f0-9]{64}$/),
  published_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(z.object({
    display_name: z.string(),
    categories: z.array(z.string()),
    institutions: z.array(institutionSchema).min(1),
    logo: runtimeLogoSchema
  }))
});

export type RuntimeCatalog = z.infer<typeof runtimeCatalogSchema>;
export type RuntimeCatalogItem = RuntimeCatalog["items"][number];
export type RuntimeLogo = RuntimeCatalogItem["logo"];
export type RuntimeAsset = RuntimeLogo["formats"][number];

export const CATALOG_PATH = "/catalog/v1/catalog.json";
export const CATALOG_ORIGIN = "https://www.awalogo.com";

export function parseRuntimeCatalog(value: unknown) {
  return runtimeCatalogSchema.parse(value);
}

export function absoluteCatalogUrl(path: string, origin = CATALOG_ORIGIN) {
  if (!path.startsWith("/catalog/v1/")) throw new Error("Catalog asset URL is outside the allowed path.");
  return new URL(path, origin).toString();
}
