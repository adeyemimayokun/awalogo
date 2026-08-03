import type { LogoStatus } from "./schema";

export type CatalogLogoBadge = "new";

type BadgeLogo = {
  added_at: string;
  status: LogoStatus;
};

export function getCatalogLogoBadge(
  logo: BadgeLogo | null,
  latestLogoAddedAt: string
): CatalogLogoBadge | null {
  if (!logo) return null;
  if (logo.status === "verified" && logo.added_at === latestLogoAddedAt) return "new";
  return null;
}
