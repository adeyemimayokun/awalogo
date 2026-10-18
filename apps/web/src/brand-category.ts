import { runtimeCatalog } from "../../../packages/catalog-ui/src/logo-data";

const categories = new Map(runtimeCatalog.items.map((item) => [item.logo.slug,
  item.institutions.find((institution) => institution.slug === item.logo.slug)?.primary_category
  ?? item.institutions[0]?.primary_category ?? item.categories[0] ?? item.logo.category
]));
const labels: Record<string, string> = {
  insurer: "Insurance company", reinsurer: "Reinsurance company", "insurance-broker": "Insurance broker",
  "crypto-vasp": "Crypto / VASP", "remittance-imto": "Remittance / IMTO", "baas": "Banking as a service"
};

export function brandCategory(slug: string, fallback: string): string {
  const category = categories.get(slug) ?? fallback;
  return labels[category] ?? category.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
