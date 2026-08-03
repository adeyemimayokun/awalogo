import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  communityCandidates,
  foreignAuthorizedInstitutions,
  institutions,
  type Institution
} from "../../institutions/src";
import { identity, knownAliases, parseSource } from "../../institutions/scripts/import-fintech-list";
import { logoCatalog } from "../src/catalog";
import { institutionLogoLinks } from "../src/institution-links";
import {
  sourcingManifestSchema,
  type SourcingCandidate,
  type SourcingDisposition,
  type SourcingManifestEntry
} from "../src/sourcing-schema";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = join(packageRoot, "../..");
const sourcePath = join(repositoryRoot, "docs/research/nigerian-fintech-companies.md");
const sourcingRoot = join(packageRoot, "sourcing");
const manifestPath = join(sourcingRoot, "fintech-340-manifest.json");
const comparisonPath = join(sourcingRoot, "fintech-source-comparison.json");
const batchRoot = join(sourcingRoot, "fintech-batches");
const snapshotDate = "2026-08-02";

const batches = [
  { id: 1, name: "Payments, infrastructure, mobile money, agency banking and BaaS" },
  { id: 2, name: "Digital banks, wallets, merchant tools, spend management and BNPL" },
  { id: 3, name: "Cross-border payments, FX and remittance" },
  { id: 4, name: "Digital lenders and credit infrastructure" },
  { id: 5, name: "Personal finance, wealth, investment and asset management" },
  { id: 6, name: "Insurance, pensions, health-tech and HR-finance" },
  { id: 7, name: "Crypto and Web3" },
  { id: 8, name: "Crowdfunding, agritech and proptech" }
] as const;

const headingBatches: Record<string, number> = {
  "Fintech Infrastructure / BaaS / Tech-Fin": 1,
  "Mobile Money / PUB / Agency & Informal Banking": 1,
  "Payments Processing, Switching & Infrastructure": 1,
  "Spend Management / Merchant Solutions / BNPL & Loyalty": 2,
  "Digital Banks (Consumer & Business)": 2,
  "Consumer Payment / Digital Wallet / Super App": 2,
  "FX / B2B & Cross-Border Payments / Remittances": 3,
  "Digital Lenders & Credit Infrastructure": 4,
  "Personal Finance, Wealth & Asset Management": 5,
  "Digital Insurance, Pensions, Health-Tech & HR": 6,
  "Crypto & Web3": 7,
  "Crowdfunding, Agritech & Proptech": 8
};

const knownLogoAliases: Record<string, string> = {
  bamboo: "bamboo-system-technology",
  cowrywise: "cowrywise-financial-technology",
  kudamfb: "kuda-microfinance-bank",
  monify: "monnify",
  momo: "momo-payment-service-bank",
  page: "paga",
  paystack: "paystack-payment"
};

type DiscoveryAsset = {
  source_url: string;
  format: SourcingCandidate["format"];
  confidence: "high" | "medium";
  local_path?: string;
  sha256?: string;
  width?: number | null;
  height?: number | null;
};
type DiscoveryEntry = {
  card_slug: string;
  searched_at?: string | null;
  website?: string | null;
  error?: string;
  candidate_assets?: DiscoveryAsset[];
};
type DiscoveryReport = { entries: DiscoveryEntry[] };
type ReviewQueue = {
  entries: Array<{
    institution_slug: string;
    candidate_path: string;
    source_url: string;
    source_type: "official-website";
    format: SourcingCandidate["format"];
    sha256: string | null;
    width: number | null;
    height: number | null;
    confidence: "high" | "medium";
  }>;
};
type CampaignPromotion = {
  institution_slug: string;
  candidate_path: string;
  source_url: string;
  source_type?: SourcingCandidate["source_type"];
  status?: "verified" | "needs-review";
  updated_at?: string;
};

const markdown = await readFile(sourcePath, "utf8");
const sourceEntries = parseSource(markdown);
const uniqueSourceEntries = new Map(sourceEntries.map((entry) => [identity(entry.name), entry]));
if (sourceEntries.length !== 392 || uniqueSourceEntries.size !== 392) {
  throw new Error(`Expected 392 unique research entries, received ${sourceEntries.length} rows and ${uniqueSourceEntries.size} unique names.`);
}

const allInstitutions = [...institutions, ...foreignAuthorizedInstitutions, ...communityCandidates];
const bySlug = new Map(allInstitutions.map((entry) => [entry.slug, entry]));
const byIdentity = new Map<string, Institution>();
for (const institution of allInstitutions) {
  for (const key of institutionKeys(institution)) if (!byIdentity.has(key)) byIdentity.set(key, institution);
}

const logoBySlug = new Map(logoCatalog.map((logo) => [logo.slug, logo]));
const logoByIdentity = new Map(logoCatalog.flatMap((logo) =>
  [logo.slug, logo.name, ...logo.aliases].map((value) => [identity(value), logo] as const)
));
const discovery = await loadDiscoveryEntries();
const reviewQueue = await loadReviewCandidates();
const previousManifest = await readJsonIfPresent<{ entries: SourcingManifestEntry[] }>(manifestPath);
const campaignEntriesByIdentity = new Map(
  (previousManifest?.entries ?? []).map((entry) => [entry.normalized_name, entry])
);
const campaignPromotions = [
  ...(await readJsonIfPresent<CampaignPromotion[]>(join(sourcingRoot, "fintech-batch-promotions.json")) ?? []),
  ...(await readJsonIfPresent<CampaignPromotion[]>(join(sourcingRoot, "fintech-unverified-promotions.json")) ?? [])
];
const campaignPromotionsByInstitution = new Map(
  campaignPromotions.map((promotion) => [promotion.institution_slug, promotion])
);
const available: Array<{ source_name: string; institution_slug: string | null; logo_slug: string }> = [];
const missing: SourcingManifestEntry[] = [];

for (const source of uniqueSourceEntries.values()) {
  const sourceIdentity = identity(source.name);
  const institution = findInstitution(sourceIdentity);
  const linkedLogoSlug = institution
    ? institution.logo_slug ?? institutionLogoLinks[institution.slug] ?? null
    : null;
  const aliasedLogoSlug = knownLogoAliases[sourceIdentity];
  const logo = (aliasedLogoSlug ? logoBySlug.get(aliasedLogoSlug) : undefined) ??
    (linkedLogoSlug ? logoBySlug.get(linkedLogoSlug) : undefined) ??
    logoByIdentity.get(sourceIdentity);
  const previousCampaignEntry = campaignEntriesByIdentity.get(sourceIdentity);
  if (logo && !previousCampaignEntry) {
    available.push({ source_name: source.name, institution_slug: institution?.slug ?? null, logo_slug: logo.slug });
    continue;
  }

  const batchId = headingBatches[source.heading];
  const batch = batches.find((entry) => entry.id === batchId);
  if (!batch) throw new Error(`No release batch configured for ${source.heading}.`);
  if (logo && previousCampaignEntry) {
    const promotion = institution ? campaignPromotionsByInstitution.get(institution.slug) : undefined;
    missing.push({
      ...previousCampaignEntry,
      source_name: source.name,
      source_category: source.heading,
      release_batch: batch.id,
      batch_name: batch.name,
      institution_slug: institution?.slug ?? previousCampaignEntry.institution_slug,
      aliases: institution?.aliases ?? previousCampaignEntry.aliases,
      verification_status: institution?.verification_status ?? previousCampaignEntry.verification_status,
      official_website: logo.website,
      candidate_assets: promotion
        ? [await promotedCandidate(promotion)]
        : previousCampaignEntry.candidate_assets,
      disposition: "promoted",
      rejection_reason: null,
      promoted_logo_slug: logo.slug,
      supported_formats: logo.formats.map((format) => format.type)
    });
    continue;
  }
  const discovered = institution ? discovery.get(institution.slug) : undefined;
  const candidateAssets = toCandidates(discovered, institution?.slug ?? null);
  const disposition: SourcingDisposition = candidateAssets.length > 0 ? "awaiting-review" : "unresolved";
  missing.push({
    source_name: source.name,
    normalized_name: sourceIdentity,
    source_category: source.heading,
    release_batch: batch.id,
    batch_name: batch.name,
    institution_slug: institution?.slug ?? null,
    aliases: institution?.aliases ?? [],
    verification_status: institution?.verification_status ?? null,
    official_website: discovered?.website ?? institution?.website ?? null,
    candidate_assets: candidateAssets,
    disposition,
    rejection_reason: disposition === "unresolved"
      ? discovered?.error ?? (institution ? "Official artwork has not been located." : "Institution identity has not been resolved.")
      : null,
    promoted_logo_slug: null,
    supported_formats: []
  });
}

available.sort((a, b) => a.source_name.localeCompare(b.source_name));
missing.sort((a, b) => a.release_batch - b.release_batch || a.source_name.localeCompare(b.source_name));
if (available.length !== 52 || missing.length !== 340) {
  throw new Error(`Expected 52 available and 340 missing logos, received ${available.length} available and ${missing.length} missing.`);
}

const manifest = sourcingManifestSchema.parse({
  source_list_name: "Nigerian Fintech Companies",
  source_file: "docs/research/nigerian-fintech-companies.md",
  snapshot_date: snapshotDate,
  generated_at: new Date().toISOString(),
  policy: "Verified assets require authoritative sources. Community and unreviewed website candidates may be published only with needs-review status and retained provenance.",
  summary: summarize(missing, sourceEntries.length, available.length),
  entries: missing
});

await mkdir(batchRoot, { recursive: true });
await writeJson(manifestPath, manifest);
await writeJson(comparisonPath, {
  snapshot_date: snapshotDate,
  source_entries: sourceEntries.length,
  unique_source_names: uniqueSourceEntries.size,
  available_count: available.length,
  missing_count: missing.length,
  available,
  missing: missing.map((entry) => ({
    source_name: entry.source_name,
    source_category: entry.source_category,
    institution_slug: entry.institution_slug,
    release_batch: entry.release_batch
  }))
});
for (const batch of batches) {
  const entries = missing.filter((entry) => entry.release_batch === batch.id);
  await writeJson(join(batchRoot, `batch-${String(batch.id).padStart(2, "0")}.json`), {
    batch: batch.id,
    name: batch.name,
    snapshot_date: snapshotDate,
    summary: dispositionSummary(entries),
    entries
  });
}
console.log(`Prepared a validated sourcing manifest for ${missing.length} missing logos across ${batches.length} release batches.`);

function findInstitution(sourceIdentity: string): Institution | undefined {
  const aliasSlug = knownAliases[sourceIdentity];
  return (aliasSlug ? bySlug.get(aliasSlug) : undefined) ?? byIdentity.get(sourceIdentity);
}

function institutionKeys(institution: Institution): string[] {
  return [institution.slug, institution.brand_name, institution.legal_name ?? "", ...institution.aliases]
    .map(identity).filter(Boolean);
}

async function loadDiscoveryEntries(): Promise<Map<string, DiscoveryEntry>> {
  const reports = await Promise.all([
    readJsonIfPresent<DiscoveryReport>(join(sourcingRoot, "web-discovery-report.json")),
    readJsonIfPresent<DiscoveryReport>(join(sourcingRoot, "fintech-web-discovery-report.json"))
  ]);
  const entries = reports.flatMap((report) => report?.entries ?? []);
  return new Map(entries.map((entry) => [entry.card_slug, entry]));
}

function toCandidates(entry: DiscoveryEntry | undefined, institutionSlug: string | null): SourcingCandidate[] {
  if (!entry) return [];
  const reviewedCandidates = institutionSlug ? reviewQueue.get(institutionSlug) : undefined;
  if (reviewedCandidates) return reviewedCandidates;
  if (reviewQueue.size > 0) return [];
  const retrievedAt = entry.searched_at?.slice(0, 10) || snapshotDate;
  return (entry.candidate_assets ?? []).filter((asset) => asset.local_path).map((asset) => ({
    source_url: asset.source_url,
    source_type: "official-website" as const,
    retrieved_at: retrievedAt,
    format: asset.format,
    local_path: asset.local_path ?? null,
    sha256: asset.sha256 ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
    confidence: asset.confidence,
    review_notes: null
  }));
}

async function loadReviewCandidates(): Promise<Map<string, SourcingCandidate[]>> {
  const queue = await readJsonIfPresent<ReviewQueue>(join(sourcingRoot, "fintech-review-queue.json"));
  const grouped = new Map<string, SourcingCandidate[]>();
  for (const entry of queue?.entries ?? []) {
    const candidate: SourcingCandidate = {
      source_url: entry.source_url,
      source_type: entry.source_type,
      retrieved_at: snapshotDate,
      format: entry.format,
      local_path: entry.candidate_path,
      sha256: entry.sha256,
      width: entry.width,
      height: entry.height,
      confidence: entry.confidence,
      review_notes: null
    };
    grouped.set(entry.institution_slug, [...(grouped.get(entry.institution_slug) ?? []), candidate]);
  }
  return grouped;
}

async function promotedCandidate(promotion: CampaignPromotion): Promise<SourcingCandidate> {
  const localPath = join(sourcingRoot, promotion.candidate_path);
  const bytes = await readFile(localPath);
  const extension = extname(promotion.candidate_path).slice(1).toLowerCase();
  const format = extension === "jpg" ? "jpeg" : extension;
  if (!["svg", "png", "webp", "jpeg", "avif"].includes(format)) {
    throw new Error(`Unsupported campaign promotion format: ${promotion.candidate_path}`);
  }
  return {
    source_url: promotion.source_url,
    source_type: promotion.source_type ?? "official-website",
    retrieved_at: promotion.updated_at ?? snapshotDate,
    format: format as SourcingCandidate["format"],
    local_path: promotion.candidate_path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: null,
    height: null,
    confidence: promotion.status === "verified" ? "high" : "medium",
    review_notes: promotion.status === "verified"
      ? `Reviewed and promoted on ${promotion.updated_at ?? snapshotDate}.`
      : `Published as needs-review on ${promotion.updated_at ?? snapshotDate}.`
  };
}

function dispositionSummary(entries: SourcingManifestEntry[]) {
  return Object.fromEntries([
    "promoted", "awaiting-review", "ready-for-promotion", "unresolved", "ineligible"
  ].map((status) => [status.replaceAll("-", "_"), entries.filter((entry) => entry.disposition === status).length]));
}

function summarize(entries: SourcingManifestEntry[], sourceCount: number, availableCount: number) {
  const dispositions = dispositionSummary(entries);
  return {
    source_entries: sourceCount,
    available: availableCount,
    missing: entries.length,
    promoted: dispositions.promoted,
    awaiting_review: dispositions.awaiting_review,
    ready_for_promotion: dispositions.ready_for_promotion,
    unresolved: dispositions.unresolved,
    ineligible: dispositions.ineligible
  };
}

async function readJsonIfPresent<T>(path: string): Promise<T | null> {
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
