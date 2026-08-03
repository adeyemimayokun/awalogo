import { z } from "zod";
import { logoFormatTypes, sourceTypes } from "./schema";

export const sourcingDispositionValues = [
  "unresolved",
  "awaiting-review",
  "ready-for-promotion",
  "promoted",
  "ineligible"
] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sourceTypeSchema = z.enum(sourceTypes);

export const sourcingCandidateSchema = z.object({
  source_url: z.string().url(),
  source_type: sourceTypeSchema,
  retrieved_at: isoDate,
  format: z.enum([...logoFormatTypes, "avif"] as const),
  local_path: z.string().min(1).nullable(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  confidence: z.enum(["high", "medium"]),
  review_notes: z.string().min(1).nullable()
});

export const sourcingManifestEntrySchema = z.object({
  source_name: z.string().min(1),
  normalized_name: z.string().min(1),
  source_category: z.string().min(1),
  release_batch: z.number().int().min(1).max(8),
  batch_name: z.string().min(1),
  institution_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable(),
  aliases: z.array(z.string().min(1)),
  verification_status: z.enum(["officially-verified", "market-verified", "community-candidate"]).nullable(),
  official_website: z.string().url().nullable(),
  candidate_assets: z.array(sourcingCandidateSchema),
  disposition: z.enum(sourcingDispositionValues),
  rejection_reason: z.string().min(1).nullable(),
  promoted_logo_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable(),
  supported_formats: z.array(z.enum(logoFormatTypes))
}).superRefine((entry, context) => {
  if (entry.disposition === "promoted" && !entry.promoted_logo_slug) {
    context.addIssue({ code: "custom", path: ["promoted_logo_slug"], message: "Promoted entries require a logo slug." });
  }
  if (["awaiting-review", "ready-for-promotion"].includes(entry.disposition) && entry.candidate_assets.length === 0) {
    context.addIssue({ code: "custom", path: ["candidate_assets"], message: "Reviewable entries require at least one candidate asset." });
  }
});

export const sourcingManifestSchema = z.object({
  source_list_name: z.string().min(1),
  source_file: z.string().min(1),
  snapshot_date: isoDate,
  generated_at: z.string().datetime(),
  policy: z.string().min(1),
  summary: z.object({
    source_entries: z.number().int().nonnegative(),
    available: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
    promoted: z.number().int().nonnegative(),
    awaiting_review: z.number().int().nonnegative(),
    ready_for_promotion: z.number().int().nonnegative(),
    unresolved: z.number().int().nonnegative(),
    ineligible: z.number().int().nonnegative()
  }),
  entries: z.array(sourcingManifestEntrySchema)
});

export type SourcingDisposition = (typeof sourcingDispositionValues)[number];
export type SourcingCandidate = z.infer<typeof sourcingCandidateSchema>;
export type SourcingManifestEntry = z.infer<typeof sourcingManifestEntrySchema>;
export type SourcingManifest = z.infer<typeof sourcingManifestSchema>;
