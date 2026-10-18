import { logos as existing, type LogoWithSvg } from "../../../packages/catalog-ui/src/logo-data";
import data from "../../../packages/brands/catalog.json";
import { expansionCatalogSchema } from "../../../packages/brands/schema";

export const expansionBrands = expansionCatalogSchema.parse(data).brands;
export const expansionBySlug = new Map(expansionBrands.map((brand) => [brand.slug, brand]));
export const logos: LogoWithSvg[] = [...existing, ...expansionBrands.map((brand) => ({
  ...brand, category: brand.industry, categories: [brand.industry], svg: "", variations: [],
  asset_urls: Object.fromEntries(brand.formats.map((asset) => [asset.type, asset.url]))
}))];
export function matchesBrandScope(slug: string, industry: string, market: string): boolean {
  const brand = expansionBySlug.get(slug);
  // Existing Nigerian financial logos retain their original records and categories.
  return (!industry || (brand?.industry ?? "financial-services") === industry)
    && (!market || (brand?.operating_countries ?? ["NG"]).includes(market));
}
export { industries } from "../../../packages/brands/schema";
export type { LogoWithSvg };
