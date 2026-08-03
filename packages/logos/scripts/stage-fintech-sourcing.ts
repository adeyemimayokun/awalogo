import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sourcingManifestSchema } from "../src/sourcing-schema";
import { communityCandidates, foreignAuthorizedInstitutions, institutions } from "../../institutions/src";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcingRoot = join(packageRoot, "sourcing");
const manifest = sourcingManifestSchema.parse(JSON.parse(
  await readFile(join(sourcingRoot, "fintech-340-manifest.json"), "utf8")
));
const report = JSON.parse(
  await readFile(join(sourcingRoot, "fintech-web-discovery-report.json"), "utf8")
) as DiscoveryReport;

const manifestBySlug = new Map(manifest.entries
  .filter((entry) => entry.institution_slug)
  .map((entry) => [entry.institution_slug!, entry]));
const verificationBySlug = new Map(
  [...institutions, ...foreignAuthorizedInstitutions, ...communityCandidates]
    .map((entry) => [entry.slug, entry.verification_status])
);
const reviewQueue: ReviewEntry[] = [];
const rejected: Array<{ institution_slug: string; source_name: string; reason: string }> = [];

for (const discovered of report.entries) {
  const manifestEntry = manifestBySlug.get(discovered.card_slug);
  if (!manifestEntry) continue;
  const candidates = discovered.candidate_assets
    .filter((asset): asset is CandidateAsset & { local_path: string } => Boolean(asset.local_path))
    .filter((asset) => sameOrganization(discovered.website, asset.source_url))
    .filter((asset) => isOwnedLogoCandidate(asset, manifestEntry.source_name))
    .sort((a, b) => assetRank(a) - assetRank(b));
  const uniqueCandidates = deduplicateCandidates(candidates);
  if (uniqueCandidates.length === 0 || !hasNigeriaEvidence(discovered, verificationBySlug.get(discovered.card_slug))) {
    rejected.push({
      institution_slug: discovered.card_slug,
      source_name: manifestEntry.source_name,
      reason: !hasNigeriaEvidence(discovered, verificationBySlug.get(discovered.card_slug))
        ? "The discovered website does not establish a Nigerian market or regulatory connection."
        : discovered.error ?? "No institution-owned logo candidate was found on the official website."
    });
    continue;
  }
  for (const [index, asset] of uniqueCandidates.entries()) {
    reviewQueue.push({
      institution_slug: discovered.card_slug,
      source_name: manifestEntry.source_name,
      source_category: manifestEntry.source_category,
      release_batch: manifestEntry.release_batch,
      candidate_rank: index + 1,
      candidate_path: asset.local_path,
      source_url: asset.source_url,
      source_type: "official-website",
      website: discovered.website!,
      format: asset.format,
      sha256: asset.sha256 ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
      confidence: asset.confidence,
      disposition: "awaiting-review",
      review: {
        official_source_confirmed: false,
        current_brand_confirmed: false,
        artwork_complete: false,
        light_mode_checked: false,
        dark_mode_checked: false,
        reviewer: null,
        reviewed_at: null,
        notes: null
      }
    });
  }
}

function isOwnedLogoCandidate(asset: CandidateAsset, sourceName: string): boolean {
  if (/(?:partner|client|customer|compliance|certif|award|google.play|app.store|background)/i.test(asset.descriptor)) return false;
  const identity = normalize(sourceName);
  const descriptorIdentity = normalize(asset.descriptor);
  const filename = safeFilename(asset.source_url);
  return /structured data logo/i.test(asset.descriptor) ||
    (identity.length >= 4 && descriptorIdentity.includes(identity) && /(?:logo|wordmark|logomark|icon)/i.test(asset.descriptor)) ||
    /^(?:sticky-|green-|primary-|brand-)?logo(?:-(?:dark|light|white|inverse))?\.(?:svg|png|webp|jpe?g)$/i.test(filename);
}

function safeFilename(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    const nested = url.searchParams.get("url");
    const path = nested ? decodeURIComponent(nested) : url.pathname;
    return path.split("/").filter(Boolean).at(-1) ?? "";
  } catch { return ""; }
}

function deduplicateCandidates<T extends CandidateAsset & { local_path: string }>(candidates: T[]): T[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.sha256 ?? candidate.source_url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasNigeriaEvidence(entry: DiscoveryEntry, verification: string | undefined): boolean {
  if (verification === "officially-verified") return true;
  const evidence = entry.search_results.map((result) => `${result.title} ${result.snippet}`).join(" ");
  return /\b(?:nigeria|nigerian|lagos|abuja|naira)\b/i.test(evidence);
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

reviewQueue.sort((a, b) => a.release_batch - b.release_batch || a.source_name.localeCompare(b.source_name) || a.candidate_rank - b.candidate_rank);
rejected.sort((a, b) => a.source_name.localeCompare(b.source_name));
await writeFile(join(sourcingRoot, "fintech-review-queue.json"), `${JSON.stringify({
  generated_at: new Date().toISOString(),
  policy: "Candidates remain private until every review check is true and a maintainer adds an explicit verified promotion.",
  summary: {
    institutions_with_candidates: new Set(reviewQueue.map((entry) => entry.institution_slug)).size,
    candidate_files: reviewQueue.length,
    rejected: rejected.length
  },
  entries: reviewQueue,
  rejected
}, null, 2)}\n`);
console.log(`Prepared ${reviewQueue.length} candidate files for private review; no public catalog files were changed.`);

function assetRank(asset: CandidateAsset): number {
  const descriptor = asset.descriptor.toLowerCase();
  const variantPenalty = /white|light|inverse|inverted|footer/.test(descriptor) ? 20 : 0;
  const formatRank = asset.format === "svg" ? 0 : asset.format === "png" ? 4 : 8;
  const squarePenalty = asset.width && asset.height && asset.width / asset.height < 1.4 ? 8 : 0;
  return variantPenalty + formatRank + squarePenalty;
}

function sameOrganization(website: string | null, asset: string): boolean {
  if (!website) return false;
  try { return rootDomain(new URL(website).hostname) === rootDomain(new URL(asset).hostname); }
  catch { return false; }
}

function rootDomain(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/^www\./, "").split(".");
  const suffix = parts.slice(-2).join(".");
  if (["com.ng", "org.ng", "net.ng", "gov.ng", "co.uk"].includes(suffix)) return parts.slice(-3).join(".");
  return suffix;
}

type CandidateAsset = {
  source_url: string;
  format: "svg" | "png" | "webp" | "jpeg" | "avif";
  descriptor: string;
  confidence: "high" | "medium";
  local_path?: string;
  sha256?: string;
  width?: number | null;
  height?: number | null;
};
type DiscoveryEntry = {
  card_slug: string;
  website: string | null;
  error?: string;
  candidate_assets: CandidateAsset[];
  search_results: Array<{ title: string; snippet: string }>;
};
type DiscoveryReport = { entries: DiscoveryEntry[] };
type ReviewEntry = {
  institution_slug: string;
  source_name: string;
  source_category: string;
  release_batch: number;
  candidate_rank: number;
  candidate_path: string;
  source_url: string;
  source_type: "official-website";
  website: string;
  format: CandidateAsset["format"];
  sha256: string | null;
  width: number | null;
  height: number | null;
  confidence: CandidateAsset["confidence"];
  disposition: "awaiting-review";
  review: {
    official_source_confirmed: boolean;
    current_brand_confirmed: boolean;
    artwork_complete: boolean;
    light_mode_checked: boolean;
    dark_mode_checked: boolean;
    reviewer: string | null;
    reviewed_at: string | null;
    notes: string | null;
  };
};
