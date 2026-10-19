import { z } from "zod";
import type { CatalogItem } from "./catalog-data";

const asset = z.object({
  type: z.enum(["svg", "png", "webp", "jpeg"]), repository_path: z.string(),
  url: z.string().regex(/^\/catalog\/plugin\/v2\/assets\/[a-f0-9]{64}\.(svg|png|webp|jpg)$/),
  checksum: z.string().regex(/^[a-f0-9]{64}$/), mime_type: z.enum(["image/svg+xml", "image/png", "image/webp", "image/jpeg"]),
  width: z.number().positive(), height: z.number().positive()
}).superRefine((value, ctx) => {
  if (!value.url.endsWith(`${value.checksum}.${value.type === "jpeg" ? "jpg" : value.type}`) || value.mime_type !== `image/${value.type === "svg" ? "svg+xml" : value.type}`) ctx.addIssue({ code: "custom", message: "Invalid resource integrity metadata" });
});
const https = z.string().regex(/^https:\/\/\S+$/);
const supplement = z.object({ schema_version: z.literal(2), items: z.array(z.object({
  kind: z.enum(["company", "flag"]), categories: z.array(z.string()).min(1),
  logo: z.object({
    name: z.string().min(1), slug: z.string().regex(/^[a-z0-9-]+$/), category: z.string(), aliases: z.array(z.string()),
    website: https, source_url: https, source_type: z.string(), status: z.enum(["verified", "needs-review"]),
    added_at: z.string(), updated_at: z.string(), preview_background: z.enum(["light", "dark"]).optional(),
    formats: z.array(asset).min(1), variations: z.array(z.object({ id: z.string(), name: z.string(), status: z.enum(["active", "old"]), source_url: https.optional(), formats: z.array(asset).min(1) }))
  })
})).max(2000) });

export function parseResources(value: unknown, origin: string): CatalogItem[] {
  const parsed = supplement.parse(value);
  const seen = new Set<string>();
  return parsed.items.map(({ logo, ...item }) => {
    if (seen.has(logo.slug) || (logo.source_type === "community-catalog" && logo.status === "verified")) throw new Error("Invalid resource identity or provenance");
    seen.add(logo.slug);
    const urls = (formats: typeof logo.formats) => Object.fromEntries(formats.map((asset) => [asset.type, `${origin}${asset.url}`]));
    return { ...item, institutions: [], displayName: logo.name, logo: { ...logo, svg: "", asset_urls: urls(logo.formats), variations: logo.variations.map((entry) => ({ ...entry, svg: "", asset_urls: urls(entry.formats) })) } };
  });
}
