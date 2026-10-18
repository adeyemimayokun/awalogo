import { logos as existing, type LogoWithSvg } from "../../../packages/catalog-ui/src/logo-data";
import data from "../../../packages/brands/catalog.json";
import { expansionCatalogSchema } from "../../../packages/brands/schema";
import telecomCoverage from "../../../packages/brands/research/telecom-market-coverage.json";
import historicalData from "../../../packages/brands/historical-catalog.json";
import { historicalCatalogSchema } from "../../../packages/brands/historical-schema";

export const expansionBrands = expansionCatalogSchema.parse(data).brands;
const historicalCatalog = historicalCatalogSchema.parse(historicalData);
export const expansionBySlug = new Map(expansionBrands.map((brand) => [brand.slug, brand]));
const telecomMarkets = new Map(telecomCoverage.map((entry) => [entry.slug, entry]));
export function historicalArtworkFor(slug: string, variation: string) {
  return historicalCatalog.variations.find((entry) => entry.slug === slug && entry.id === variation);
}
export function operatingMarketsFor(slug: string): string[] {
  return [...new Set([...(expansionBySlug.get(slug)?.operating_countries ?? ["NG"]), ...(telecomMarkets.get(slug)?.operating_countries ?? [])])];
}
export const logos: LogoWithSvg[] = [...existing, ...expansionBrands.map((brand) => ({
  ...brand, aliases: [...brand.aliases, ...(telecomMarkets.get(brand.slug)?.aliases ?? [])], category: brand.industry, categories: [brand.industry], svg: "",
  variations: historicalCatalog.variations.filter((entry) => entry.slug === brand.slug).map((entry) => ({ id: entry.id, name: entry.name, status: "old" as const, source_url: entry.source_url, formats: entry.formats, svg: "", asset_urls: Object.fromEntries(entry.formats.map((asset) => [asset.type, asset.url])) })),
  asset_urls: Object.fromEntries(brand.formats.map((asset) => [asset.type, asset.url]))
}))];
export function matchesBrandScope(slug: string, industry: string, market: string): boolean {
  const brand = expansionBySlug.get(slug);
  // Existing Nigerian financial logos retain their original records and categories.
  return (!industry || (brand?.industry ?? "financial-services") === industry)
    && (!market || operatingMarketsFor(slug).includes(market));
}
export { industries } from "../../../packages/brands/schema";
export type { LogoWithSvg };
