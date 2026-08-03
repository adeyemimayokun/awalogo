import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sourcingManifestSchema } from "./sourcing-schema";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = sourcingManifestSchema.parse(JSON.parse(
  readFileSync(join(packageRoot, "sourcing/fintech-340-manifest.json"), "utf8")
));

describe("fintech sourcing campaign", () => {
  it("keeps the canonical comparison totals stable", () => {
    expect(manifest.summary).toMatchObject({ source_entries: 392, available: 52, missing: 340 });
    expect(manifest.entries).toHaveLength(340);
    expect(new Set(manifest.entries.map((entry) => entry.normalized_name)).size).toBe(340);
  });

  it("assigns every missing institution to one of eight release batches", () => {
    expect(new Set(manifest.entries.map((entry) => entry.release_batch))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it("records promoted candidates with provenance", () => {
    const promoted = manifest.entries.filter((entry) => entry.disposition === "promoted");
    expect(promoted).toHaveLength(manifest.summary.promoted);
    expect(promoted.every((entry) =>
      entry.promoted_logo_slug && entry.supported_formats.length > 0
    )).toBe(true);
    const sourceTypes = new Set([
      "official-brand-page", "official-website", "annual-report", "verified-pdf", "other-official", "community-catalog"
    ]);
    expect(manifest.entries.flatMap((entry) => entry.candidate_assets)
      .every((candidate) => sourceTypes.has(candidate.source_type))).toBe(true);
  });
});
