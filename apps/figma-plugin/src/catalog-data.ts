import type { Institution, InstitutionCategory } from "@awalogo/institutions";
import type { RuntimeCatalog } from "@awalogo/catalog-ui/runtime-catalog";
import { hydrateRuntimeLogos, type LogoWithSvg } from "./logo-data";
import { categoryLabel, primaryCategoryFor, categoryOptions, matchesCategory } from "@awalogo/catalog-ui/catalog-categories";
export { categoryLabel, matchesCategory };

export type CatalogItem = {
  institution?: Institution;
  kind?: "company" | "flag";
  institutions: Institution[];
  logo: LogoWithSvg;
  displayName: string;
  categories: string[];
};

export function catalogItemsFromRuntime(catalog: RuntimeCatalog, origin?: string): CatalogItem[] {
  const logosBySlug = new Map(hydrateRuntimeLogos(catalog, origin).map((logo) => [logo.slug, logo]));
  return catalog.items.map((item) => ({
    institution: item.institutions[0],
    institutions: item.institutions,
    logo: logosBySlug.get(item.logo.slug)!,
    displayName: item.display_name,
    categories: item.categories as InstitutionCategory[]
  }));
}

export function availableCategories(items: CatalogItem[]) {
  return categoryOptions(items.map((item) => item.logo)).map((entry) => entry.value);
}

export function displayCategory(item: CatalogItem): string {
  return categoryLabel(primaryCategoryFor(item));
}

export function catalogCategoryOptions(items: CatalogItem[]) {
  return categoryOptions(items.map((item) => item.logo));
}
