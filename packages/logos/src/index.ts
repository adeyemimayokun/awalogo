export { logoCatalog } from "./catalog";
export { institutionLogoLinks } from "./institution-links";
export { darkLogoPreviewAssetIds, usesDarkLogoPreview } from "./preview";
export { getCatalogLogoBadge } from "./catalog-badge";
export type { CatalogLogoBadge } from "./catalog-badge";
export {
  logoCatalogSchema,
  logoCategories,
  logoEntrySchema,
  logoFormatSchema,
  logoFormatTypes,
  logoVariationSchema,
  logoStatuses,
  sourceTypes
} from "./schema";
export type {
  LogoCategory,
  LogoEntry,
  LogoFormat,
  LogoFormatType,
  LogoStatus,
  LogoVariation,
  SourceType
} from "./schema";
export {
  sourcingCandidateSchema,
  sourcingDispositionValues,
  sourcingManifestEntrySchema,
  sourcingManifestSchema
} from "./sourcing-schema";
export type {
  SourcingCandidate,
  SourcingDisposition,
  SourcingManifest,
  SourcingManifestEntry
} from "./sourcing-schema";
import type { LogoCategory } from "./schema";
import { logoCatalog } from "./catalog";

export function findLogoBySlug(slug: string) {
  return logoCatalog.find((logo) => logo.slug === slug);
}

export function getLogosByCategory(category: LogoCategory) {
  return logoCatalog.filter((logo) => logo.category === category);
}
