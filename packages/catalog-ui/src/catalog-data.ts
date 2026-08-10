import {
  institutionCategories,
  type Institution,
  type InstitutionCategory
} from "@awalogo/institutions";
import communityCandidatesJson from "../../../packages/institutions/data/community-candidates.json";
import foreignAuthorizedJson from "../../../packages/institutions/exports/foreign-authorized-ng.json";
import institutionsJson from "../../../packages/institutions/exports/institutions-ng.json";
import { institutionLogoLinks } from "../../../packages/logos/src/institution-links";
import fintechSourcingManifest from "../../../packages/logos/sourcing/fintech-340-manifest.json";
import { buildCatalogProjection } from "./catalog-projection";
import { logos, runtimeCatalog, type LogoWithSvg } from "./logo-data";

export type CatalogItem = {
  institution: Institution;
  institutions: Institution[];
  logo: LogoWithSvg | null;
  displayName: string;
  categories: InstitutionCategory[];
};

export type LogoCatalogItem = CatalogItem & { logo: LogoWithSvg };

const institutions = [
  ...institutionsJson,
  ...foreignAuthorizedJson,
  ...communityCandidatesJson
] as Institution[];
const institutionCategorySet = new Set<string>(institutionCategories);
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
const projection = buildCatalogProjection({
  institutions,
  logos,
  institutionLogoLinks,
  institutionCategories
});
const institutionItems = projection.institutionItems as CatalogItem[];
const institutionItemsBySlug = new Map(institutionItems.map((item) => [item.institution.slug, item]));
export const catalogItems = projection.catalogItems as CatalogItem[];

export const institutionCount = catalogItems.length;
const hydratedLogosBySlug = new Map(logos.map((logo) => [logo.slug, logo]));
export const logoCatalogItems: LogoCatalogItem[] = runtimeCatalog.items.map((item) => ({
  institution: item.institutions[0],
  institutions: item.institutions,
  logo: hydratedLogosBySlug.get(item.logo.slug)!,
  displayName: item.display_name,
  categories: item.categories as InstitutionCategory[]
}));
export const availableLogoCount = logoCatalogItems.length;
export const canonicalLogoCount = logos.length;

export const manifestCatalogItems: CatalogItem[] = fintechSourcingManifest.entries
  .flatMap((entry) => {
    const item = institutionItemsBySlug.get(entry.institution_slug);
    return item ? [item] : [];
  });
export const manifestEntryCount = fintechSourcingManifest.entries.length;
export const manifestPendingCount = manifestCatalogItems.filter((item) => item.logo === null).length;

export const explorerCatalogItems = logoCatalogItems;

export const availableInstitutionCategories = [...new Set(
  explorerCatalogItems.flatMap((item) => item.categories)
)].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));

export function categoryLabel(category: InstitutionCategory): string {
  return categoryOverrides[category] ?? category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
