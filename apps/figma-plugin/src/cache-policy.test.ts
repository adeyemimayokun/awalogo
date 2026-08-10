import { describe, expect, it } from "vitest";
import { trimAssetCache } from "./cache-policy";

describe("plugin asset cache policy", () => {
  it("evicts least recently used assets within the configured limit", () => {
    const result = trimAssetCache([
      { checksum: "old", size: 6, lastUsed: 1 },
      { checksum: "recent", size: 4, lastUsed: 2 }
    ], { checksum: "new", size: 5, lastUsed: 3 }, 10);

    expect(result.entries.map((entry) => entry.checksum)).toEqual(["recent", "new"]);
    expect(result.evicted).toEqual(["old"]);
  });

  it("does not cache an individual asset larger than the budget", () => {
    const result = trimAssetCache([], { checksum: "large", size: 11, lastUsed: 1 }, 10);
    expect(result.cacheIncoming).toBe(false);
  });
});
