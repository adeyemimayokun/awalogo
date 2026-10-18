import { z } from "zod";

export const industries = ["financial-services", "technology", "telecommunications", "retail-commerce", "food-beverages", "transport-logistics", "energy-utilities", "healthcare", "education", "media-entertainment", "manufacturing-consumer-goods", "real-estate-construction"] as const;
const country = z.string().regex(/^[A-Z]{2}$/);
const httpUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Expected a public HTTPS source URL");
export const expansionBrandSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: z.string().min(2), aliases: z.array(z.string()),
  industry: z.enum(industries), origin_country: country.nullable(), headquarters_country: country.nullable(),
  operating_countries: z.array(country).min(1), website: httpUrl,
  source_url: httpUrl, source_type: z.enum(["official-website", "official-brand-page", "annual-report", "verified-pdf", "community-catalog"]),
  preview_background: z.enum(["light", "dark"]),
  status: z.enum(["verified", "needs-review"]), added_at: z.string(), updated_at: z.string(),
  reviewed_at: z.string(), reviewer: z.string().min(2), review_notes: z.string().min(10), batch: z.string().min(1),
  evidence: z.array(z.object({ url: httpUrl, note: z.string().min(10), retrieved_at: z.string() })).min(1),
  formats: z.array(z.object({ type: z.enum(["svg", "png", "webp", "jpeg"]), url: z.string().regex(/^\/catalog\/v2\/assets\/[a-f0-9]{64}\.(svg|png|webp|jpg)$/), repository_path: z.string(), mime_type: z.enum(["image/svg+xml", "image/png", "image/webp", "image/jpeg"]), checksum: z.string().regex(/^[a-f0-9]{64}$/), width: z.number().positive(), height: z.number().positive() })).min(2)
}).superRefine((brand, ctx) => {
  if (brand.source_type === "community-catalog" && brand.status === "verified") ctx.addIssue({ code: "custom", message: "Community artwork cannot be marked officially verified" });
  for (const asset of brand.formats) {
    const extension = asset.type === "jpeg" ? "jpg" : asset.type;
    if (asset.url !== `/catalog/v2/assets/${asset.checksum}.${extension}` || asset.mime_type !== (asset.type === "svg" ? "image/svg+xml" : `image/${asset.type}`)) ctx.addIssue({ code: "custom", message: "Asset path, format, checksum and MIME type must agree" });
  }
});
export const expansionCatalogSchema = z.object({ schema_version: z.literal(1), brands: z.array(expansionBrandSchema) });
export type ExpansionBrand = z.infer<typeof expansionBrandSchema>;
