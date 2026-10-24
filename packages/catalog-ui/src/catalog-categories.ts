type CategoryRecord = {
  logo: { slug: string; category: string };
  institutions: ReadonlyArray<{ slug: string; primary_category: string }>;
  categories: readonly string[];
};

const labels: Record<string, string> = {
  insurer: "Insurance company", reinsurer: "Reinsurance company", "insurance-broker": "Insurance broker",
  "crypto-vasp": "Crypto / VASP", "remittance-imto": "Remittance / IMTO", baas: "Banking as a service"
};

export function categoryLabel(value: string): string {
  return labels[value] ?? value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function primaryCategoryFor(item: CategoryRecord): string {
  return item.institutions.find((institution) => institution.slug === item.logo.slug)?.primary_category
    ?? item.institutions[0]?.primary_category ?? item.categories[0] ?? item.logo.category;
}

export function categoryOptions(brands: ReadonlyArray<{ category: string }>) {
  const counts = new Map<string, number>();
  for (const brand of brands) counts.set(brand.category, (counts.get(brand.category) ?? 0) + 1);
  return [...counts.keys()].sort().map((value) => ({ value, count: counts.get(value)! }));
}

export function matchesCategory(category: string, selected: readonly string[]): boolean {
  return selected.length === 0 || selected.includes(category);
}
