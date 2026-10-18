import { z } from "zod";
import { expansionAssetSchema } from "./schema";

export const historicalCatalogSchema = z.object({ variations: z.array(z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/), id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1), brand_name: z.string().min(1),
  status: z.literal("needs-review"), variation_status: z.literal("old"), source_type: z.literal("community-catalog"),
  source_path: z.string().regex(/^assets\/[a-z0-9-]+\.svg$/), source_checksum: z.string().regex(/^[a-f0-9]{64}$/),
  source_url: z.string().url().startsWith("https://"), identity_evidence: z.string().url().startsWith("https://"),
  reviewer: z.string().min(2), reviewed_at: z.string(), visual_reviewed: z.literal(true), review_notes: z.string().min(10),
  formats: z.array(expansionAssetSchema).min(1)
})) });
