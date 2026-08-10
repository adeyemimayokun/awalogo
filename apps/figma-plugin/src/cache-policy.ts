export const ASSET_CACHE_LIMIT = 3_500_000;

export type AssetCacheEntry = {
  checksum: string;
  size: number;
  lastUsed: number;
};

export function trimAssetCache(entries: AssetCacheEntry[], incoming: AssetCacheEntry, limit = ASSET_CACHE_LIMIT) {
  const retained = entries.filter((entry) => entry.checksum !== incoming.checksum);
  if (incoming.size > limit) return { entries: retained, evicted: [] as string[], cacheIncoming: false };

  const next = [...retained, incoming];
  const evicted: string[] = [];
  let total = next.reduce((sum, entry) => sum + entry.size, 0);
  next.sort((a, b) => a.lastUsed - b.lastUsed || a.checksum.localeCompare(b.checksum));
  while (total > limit && next.length > 1) {
    const removed = next.shift()!;
    total -= removed.size;
    evicted.push(removed.checksum);
  }
  return { entries: next, evicted, cacheIncoming: true };
}
