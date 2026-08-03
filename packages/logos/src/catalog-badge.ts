import type { LogoStatus } from "./schema";

export type CatalogLogoBadge = "new" | "unverified";

type BadgeLogo = {
  added_at: string;
  status: LogoStatus;
};

export function getCatalogLogoBadge(
  logo: BadgeLogo | null,
  latestLogoAddedAt: string
): CatalogLogoBadge | null {
  if (!logo) return null;
  if (logo.status === "needs-review") return "unverified";
  if (logo.status === "verified" && logo.added_at === latestLogoAddedAt) return "new";
  return null;
}
