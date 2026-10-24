import { z } from "zod";
import { expansionAssetSchema } from "./schema";

export const historicalCatalogSchema = z.object({
  variations: z.array(
    z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/),
      id: z.string().regex(/^[a-z0-9-]+$/),
      name: z.string().min(1),
      brand_name: z.string().min(1),
      status: z.enum(["needs-review", "verified"]),
      variation_status: z.literal("old"),
      source_type: z.enum([
        "community-catalog",
        "official-website",
        "official-brand-page",
        "annual-report",
        "verified-pdf",
      ]),
      source_path: z
        .string()
        .regex(/^assets\/[a-z0-9-]+\.(?:svg|png|webp|jpeg|jpg)$/),
      source_checksum: z.string().regex(/^[a-f0-9]{64}$/),
      source_url: z.string().url().startsWith("https://"),
      identity_evidence: z.string().url().startsWith("https://"),
      reviewer: z.string().min(2),
      reviewed_at: z.string(),
      visual_reviewed: z.literal(true),
      review_notes: z.string().min(10),
      formats: z.array(expansionAssetSchema).min(1),
    }),
  ),
}).superRefine(({variations},context)=>{for(const [index,entry] of variations.entries())if(entry.source_type==='community-catalog'&&entry.status==='verified')context.addIssue({code:'custom',path:['variations',index,'status'],message:'Community artwork cannot be marked officially verified'});});
