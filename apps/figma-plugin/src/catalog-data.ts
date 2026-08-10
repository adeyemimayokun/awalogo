import type { Institution, InstitutionCategory } from "@awalogo/institutions";
import type { RuntimeCatalog } from "@awalogo/catalog-ui/runtime-catalog";
import { hydrateRuntimeLogos, type LogoWithSvg } from "./logo-data";

export type CatalogItem = {
  institution: Institution;
  institutions: Institution[];
  logo: LogoWithSvg;
  displayName: string;
  categories: InstitutionCategory[];
};

const categoryOverrides: Partial<Record<InstitutionCategory, string>> = {
  "crypto-vasp": "Crypto / VASP",
  "development-finance-institution": "Development finance",
  "payment-solution-service-provider": "Payment solutions",
  "payment-terminal-service-provider": "Payment terminals",
  "payment-service-holding-company": "Payment holding company",
  "pension-fund-administrator": "Pension administrator",
  "pension-fund-custodian": "Pension custodian",
  "remittance-imto": "Remittance / IMTO",
  "switching-processing": "Switching / processing"
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
  return [...new Set(items.flatMap((item) => item.categories))]
    .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
}

export function categoryLabel(category: InstitutionCategory): string {
  return categoryOverrides[category] ?? category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
