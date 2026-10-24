import { runtimeCatalog } from "../../../packages/catalog-ui/src/logo-data";
import { categoryLabel, primaryCategoryFor } from "../../../packages/catalog-ui/src/catalog-categories";

const categories = new Map(runtimeCatalog.items.map((item) => [item.logo.slug, primaryCategoryFor(item)]));

export function brandCategory(slug: string, fallback: string): string {
  const category = categories.get(slug) ?? fallback;
  return categoryLabel(category);
}
