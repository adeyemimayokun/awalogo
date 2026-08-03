/**
 * Asset IDs whose artwork contains a light wordmark intended for a dark surface.
 * Variation IDs use the same `${logoSlug}-${variationId}` shape as the catalog UI.
 */
export const darkLogoPreviewAssetIds = [
  "anchor",
  "bamboo-system-technology-dark",
  "bank-of-industry-light",
  "busha-digital-light",
  "cardinalstone-securities",
  "cardinalstone-securities-light",
  "chapel-hill-denham",
  "cleva",
  "coronation-merchant-bank-light",
  "errandpay-light-wordmark",
  "fcmb-pensions-light",
  "fsdh-holding-company-light",
  "grey",
  "interswitch-light",
  "investnaija",
  "keystone-bank",
  "kiakia-bits-light",
  "klump-technology-company",
  "lasaco-assurance-dark",
  "meristem-securities",
  "onafriq-light",
  "onepipe-io-services-light",
  "premiumtrust-bank",
  "sovereign-trust-insurance",
  "sterling-financial-holdings-company",
  "sycamore-integrated-solutions-light",
  "tajbank-light",
  "the-alternative-bank",
  "timon",
  "umba-digital-solutions",
  "union-bank-of",
  "veritas-glanvills-pensions-light"
] as const;

const darkLogoPreviewAssetIdSet = new Set<string>(darkLogoPreviewAssetIds);

export function usesDarkLogoPreview(assetId: string) {
  return darkLogoPreviewAssetIdSet.has(assetId);
}
