type Brand = { slug: string; name: string; added_at: string };
export type DownloadCounts = Record<string, number>;
export type BrandSort = "popular" | "name" | "newest";

// Editorial starting points, not measured market-share or search-volume claims.
export const prominence: Record<string, number> = {
  "airtel-nigeria": 100, "globacom": 95, "shoprite": 95,
  "jumia-nigeria": 95, "mtn-group": 100,
  "access-bank": 100, "guaranty-trust-bank": 100, "zenith-bank": 100,
  "united-bank-for-africa": 100, "first-bank-of": 100,
  "opay": 100, "palmpay": 95, "moniepoint": 95, "paystack-payment": 95,
  "flutterwave": 95, "kuda-microfinance-bank": 90, "interswitch": 90,
  "wema-bank": 85, "stanbic-ibtc-bank": 85, "fidelity-bank": 85,
  "sterling-bank": 80, "union-bank": 80, "ecobank": 80,
  "carbon": 75, "cowrywise": 75, "piggyvest": 85,
  "fairmoney-microfinance-bank": 75, "paga": 75, "chipper-cash": 75,
  "alat-by-wema": 70, "bamboo-system-technology": 70, "risevest": 70
};

export function popularityScore(slug: string, counts: DownloadCounts): number {
  const count = counts[slug];
  const downloads = Number.isSafeInteger(count) && count > 0 ? count : 0;
  // Log scaling lets real demand influence ranking without one runaway total dominating.
  return (prominence[slug] ?? 20) * .6 + Math.min(1, Math.log1p(downloads) / Math.log1p(1000)) * 40;
}

export function sortBrands<T extends Brand>(items: T[], sort: BrandSort, counts: DownloadCounts): T[] {
  return [...items].sort((a, b) => {
    const difference = sort === "popular" ? popularityScore(b.slug, counts) - popularityScore(a.slug, counts)
      : sort === "newest" ? (Date.parse(b.added_at) || 0) - (Date.parse(a.added_at) || 0) : 0;
    return difference || a.name.localeCompare(b.name, "en") || a.slug.localeCompare(b.slug, "en");
  });
}

export async function recordDownloads(slugs: string[]): Promise<void> {
  try {
    await fetch("/api/logo-requests?view=popularity", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: [...new Set(slugs)] }), keepalive: true,
      signal: AbortSignal.timeout(4000)
    });
  } catch { /* Counting must never interrupt an asset download. */ }
}
