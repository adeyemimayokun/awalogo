import { describe, expect, it } from "vitest";
import generatedRuntimeCatalog from "../../../packages/catalog-ui/src/generated/runtime-catalog.json";
import { parseRuntimeCatalog } from "@awalogo/catalog-ui/runtime-catalog";
import { catalogItemsFromRuntime } from "./catalog-data";
import { searchScore } from "./catalog-search";

const explorerCatalogItems = catalogItemsFromRuntime(parseRuntimeCatalog(generatedRuntimeCatalog));

function resultsFor(query: string) {
  return explorerCatalogItems
    .map((item) => ({ item, score: searchScore(item, query) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => a.score - b.score || a.item.displayName.localeCompare(b.item.displayName))
    .map(({ item }) => item.displayName);
}

describe("catalog search ranking", () => {
  it("orders direct public-name matches before secondary metadata matches", () => {
    expect(resultsFor("rem")[0]).toBe("Remita Payment Service");
    expect(resultsFor("passpoint")).toEqual([]);
  });

  it("still finds an institution through a merged legal name", () => {
    expect(resultsFor("flutterwave tech payments")[0]).toBe("Flutterwave");
  });
});
