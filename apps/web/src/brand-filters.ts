import { matchesCategory } from "../../../packages/catalog-ui/src/catalog-categories";
import searchAliases from "../../../packages/brands/research/search-aliases.json";

export function toggleCategory(selected: string[], value: string): string[] {
  if (value === "all") return [];
  return selected.includes(value) ? selected.filter((category) => category !== value) : [...selected, value];
}

export function filterBrands<T extends { category: string; name: string; aliases: string[]; slug?: string }>(brands: T[], selected: string[], query: string): T[] {
  const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const text = normalize(query);
  return brands.filter((brand) => {
    const extra = (searchAliases as Record<string, { aliases:string[] }>)[brand.slug ?? ""]?.aliases ?? [];
    return matchesCategory(brand.category, selected) && [brand.name, ...brand.aliases, ...extra].some((name) => normalize(name).includes(text));
  });
}
