import { z } from "zod";

export const institutionCategorySchema = z.enum([
  "commercial-bank", "microfinance-bank", "fintech", "crypto-vasp",
  "financial-holding-company", "remittance-imto", "mobile-money-operator",
  "bureau-de-change", "payment-service-bank", "non-interest-bank",
  "primary-mortgage-bank", "merchant-bank", "development-finance-institution",
  "discount-house", "finance-company", "switching-processing",
  "payment-solution-service-provider", "payment-terminal-service-provider",
  "super-agent", "payment-service-holding-company", "card-scheme",
  "clearing-house", "credit-bureau", "digital-lender", "crowdfunding-platform",
  "robo-adviser", "digital-broker", "investment-manager", "insurer", "reinsurer",
  "insurance-broker", "pension-fund-administrator", "pension-fund-custodian",
  "regulator", "finance-app", "stockbroker"
]);

const logoFormatSchema = z.object({
  type: z.enum(["svg", "png", "webp", "jpeg"]),
  path: z.string().regex(/^assets\/[a-z0-9-]+\.(?:svg|png|webp|jpg)$/),
  mime_type: z.enum(["image/svg+xml", "image/png", "image/webp", "image/jpeg"]),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable()
});

export const logoVariationSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2),
  status: z.enum(["active", "old"]).optional(),
  archived_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source_url: z.string().url().optional(),
  source_path: z.string().regex(/^(?:assets|sources)\/[a-z0-9-]+\.(?:svg|png|webp|jpg)$/),
  svg_path: z.string().regex(/^assets\/[a-z0-9-]+\.svg$/).nullable(),
  formats: z.array(logoFormatSchema).min(1)
});

export const logoEntrySchema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.enum(["commercial-bank", "microfinance-bank", "merchant-bank", "payment-bank", "fintech", "other"]),
  categories: z.array(institutionCategorySchema).min(1).optional(),
  aliases: z.array(z.string().min(1)).default([]),
  website: z.string().url(),
  source_url: z.string().url(),
  source_type: z.enum(["official-brand-page", "official-website", "annual-report", "verified-pdf", "other-official", "community-catalog"]),
  source_path: z.string().regex(/^(?:assets|sources)\/[a-z0-9-]+\.(?:svg|png|webp|jpg)$/),
  svg_path: z.string().regex(/^assets\/[a-z0-9-]+\.svg$/).nullable(),
  formats: z.array(logoFormatSchema).min(1),
  variations: z.array(logoVariationSchema).optional(),
  added_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["verified", "needs-review", "deprecated"])
});

export const logoCatalogSchema = z.array(logoEntrySchema);
