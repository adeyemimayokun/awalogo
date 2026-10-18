export function toggleCategory(selected: string[], value: string): string[] {
  if (value === "all") return [];
  return selected.includes(value) ? selected.filter((category) => category !== value) : [...selected, value];
}

export function filterBrands<T extends { category: string; name: string; aliases: string[] }>(brands: T[], selected: string[], query: string): T[] {
  const text = query.trim().toLowerCase();
  return brands.filter((brand) => (!selected.length || selected.includes(brand.category)) && `${brand.name} ${brand.aliases.join(" ")}`.toLowerCase().includes(text));
}
