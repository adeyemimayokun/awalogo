import { z } from "zod";

export const logoCategories = [
  "commercial-bank",
  "microfinance-bank",
  "merchant-bank",
  "payment-bank",
  "fintech",
  "other"
] as const;

export const sourceTypes = [
  "official-brand-page",
  "official-website",
  "annual-report",
  "verified-pdf",
  "other-official",
  "community-catalog"
] as const;

export const logoStatuses = ["verified", "needs-review", "deprecated"] as const;
export const logoFormatTypes = ["svg", "png", "webp", "jpeg"] as const;

export const logoFormatSchema = z.object({
  type: z.enum(logoFormatTypes),
  path: z.string().regex(/^assets\/[a-z0-9-]+\.(?:svg|png|webp|jpg)$/),
  mime_type: z.enum(["image/svg+xml", "image/png", "image/webp", "image/jpeg"]),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable()
});

export const logoVariationSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2),
  kind: z.enum(["lockup", "historical"]).optional(),
  retired_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source_url: z.string().url().optional(),
  source_path: z.string().regex(/^(?:assets|sources)\/[a-z0-9-]+\.(?:svg|png|webp|jpg)$/),
  svg_path: z.string().regex(/^assets\/[a-z0-9-]+\.svg$/).nullable(),
  formats: z.array(logoFormatSchema).min(1)
});

export const logoEntrySchema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.enum(logoCategories),
  categories: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1).optional(),
  aliases: z.array(z.string().min(1)).default([]),
  website: z.string().url(),
  source_url: z.string().url(),
  source_type: z.enum(sourceTypes),
  source_path: z.string().regex(/^(?:assets|sources)\/[a-z0-9-]+\.(?:svg|png|webp|jpg)$/),
  svg_path: z.string().regex(/^assets\/[a-z0-9-]+\.svg$/).nullable(),
  formats: z.array(logoFormatSchema).min(1),
  variations: z.array(logoVariationSchema).optional(),
  added_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(logoStatuses)
});

export const logoCatalogSchema = z.array(logoEntrySchema);

export type LogoCategory = (typeof logoCategories)[number];
export type SourceType = (typeof sourceTypes)[number];
export type LogoStatus = (typeof logoStatuses)[number];
export type LogoFormatType = (typeof logoFormatTypes)[number];
export type LogoFormat = z.infer<typeof logoFormatSchema>;
export type LogoVariation = z.infer<typeof logoVariationSchema>;
export type LogoEntry = z.infer<typeof logoEntrySchema>;
