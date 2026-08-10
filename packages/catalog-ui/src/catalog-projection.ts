import type { Institution, InstitutionCategory } from "@awalogo/institutions";

export type ProjectionLogo = {
  name: string;
  slug: string;
  aliases: string[];
  categories?: string[];
  website: string;
  source_url: string;
  source_type: string;
  added_at: string;
  updated_at: string;
  status: "verified" | "needs-review" | "deprecated";
};

export type ProjectedCatalogItem<TLogo extends ProjectionLogo> = {
  institution: Institution;
  institutions: Institution[];
  logo: TLogo | null;
  displayName: string;
  categories: InstitutionCategory[];
};

const commonBrandNames: Record<string, string> = {
  "cordros-insurance-brokers": "Cordros",
  "custodian-and-allied-insurance": "Custodian",
  "emple-general-insurance-company": "emPLE",
  "fairmoney-microfinance-bank": "FairMoney",
  "heirs-general-insurance": "Heirs Insurance",
  "kiakia-bits": "KiaKia",
  "palmpay": "PalmPay",
  "pagatech": "Paga",
  "mutual-benefit-assurance": "Mutual Benefits",
  "renmoney-microfinance-bank": "Renmoney",
  "tangerine-general-insurance": "Tangerine",
  "vfd-microfinance-bank": "VBank"
};

const genericBrandWords = new Set([
  "company", "global", "international", "limited", "ltd", "nigeria", "nigerian",
  "payment", "payments", "plc", "service", "services", "solution", "solutions",
  "technologies", "technology"
]);

function brandIdentity(value: string): string {
  const words = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return words.filter((word) => !genericBrandWords.has(word)).join("") || words.join("");
}

function preferredInstitution(records: Institution[]): Institution {
  return [...records].sort((a, b) => {
    const verificationRank = (record: Institution) => record.verification_status === "officially-verified"
      ? 0
      : record.verification_status === "market-verified" ? 1 : 2;
    return verificationRank(a) - verificationRank(b) ||
      Number(Boolean(b.website)) - Number(Boolean(a.website)) ||
      a.brand_name.length - b.brand_name.length ||
      a.slug.localeCompare(b.slug);
  })[0];
}

function mergeCatalogItems<TLogo extends ProjectionLogo>(items: ProjectedCatalogItem<TLogo>[]) {
  const groups = new Map<string, ProjectedCatalogItem<TLogo>[]>();

  for (const item of items) {
    const key = item.logo ? `logo:${item.logo.slug}` : `brand:${brandIdentity(item.displayName)}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const institutions = group.flatMap((item) => item.institutions);
    const logo = group.find((item) => item.logo)?.logo ?? null;
    const preferredNames = group.map((item) => item.displayName).sort((a, b) =>
      a.length - b.length || a.localeCompare(b)
    );
    return {
      institution: preferredInstitution(institutions),
      institutions,
      logo,
      displayName: logo ? commonBrandNames[logo.slug] ?? logo.name : preferredNames[0],
      categories: [...new Set(group.flatMap((item) => item.categories))]
    } satisfies ProjectedCatalogItem<TLogo>;
  });
}

export function buildCatalogProjection<TLogo extends ProjectionLogo>({
  institutions,
  logos,
  institutionLogoLinks,
  institutionCategories
}: {
  institutions: Institution[];
  logos: TLogo[];
  institutionLogoLinks: Record<string, string>;
  institutionCategories: readonly string[];
}) {
  const logosBySlug = new Map(logos.map((logo) => [logo.slug, logo]));
  const institutionCategorySet = new Set(institutionCategories);
  const institutionItems: ProjectedCatalogItem<TLogo>[] = institutions.map((institution) => {
    const logoSlug = institution.logo_slug ?? institutionLogoLinks[institution.slug] ??
      (logosBySlug.has(institution.slug) ? institution.slug : undefined);
    const logo = logoSlug ? logosBySlug.get(logoSlug) ?? null : null;
    const fallbackName = institution.legal_name ?? institution.slug;
    const displayName = logo
      ? commonBrandNames[logo.slug] ?? logo.name
      : institution.brand_name === "N/A" ? fallbackName : institution.brand_name;
    return {
      institution,
      institutions: [institution],
      logo,
      displayName,
      categories: [...new Set([
        ...institution.categories,
        ...((logo?.categories ?? []).filter((category): category is InstitutionCategory =>
          institutionCategorySet.has(category)
        ))
      ])]
    };
  });

  const linkedLogoSlugs = new Set(institutionItems.flatMap((item) => item.logo ? [item.logo.slug] : []));
  const orphanLogoItems: ProjectedCatalogItem<TLogo>[] = logos.flatMap((logo) => {
    if (linkedLogoSlugs.has(logo.slug)) return [];
    const categories = (logo.categories ?? []).filter((category): category is InstitutionCategory =>
      institutionCategorySet.has(category)
    );
    const primaryCategory = categories[0];
    if (!primaryCategory) return [];
    const reviewed = logo.status === "verified" && logo.source_type !== "community-catalog";
    const institution: Institution = {
      slug: logo.slug,
      legal_name: null,
      brand_name: logo.name,
      aliases: logo.aliases,
      primary_category: primaryCategory,
      categories,
      country_code: "NG",
      nigeria_presence: "market-only",
      regulators: [],
      licence_types: [],
      regulatory_status: reviewed ? "status-unknown" : "unverified",
      verification_status: reviewed ? "market-verified" : "community-candidate",
      website: logo.website,
      sources: [{
        url: logo.source_url,
        source_type: logo.source_type === "community-catalog" ? "community" : "official-website",
        retrieved_at: logo.updated_at
      }],
      logo_slug: logo.slug,
      added_at: logo.added_at,
      updated_at: logo.updated_at
    };
    return [{ institution, institutions: [institution], logo, displayName: logo.name, categories }];
  });

  return {
    catalogItems: mergeCatalogItems([...institutionItems, ...orphanLogoItems])
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    institutionItems
  };
}
