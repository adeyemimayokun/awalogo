export type AdminResource = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  kind: "logo" | "flag";
  collection: "financial" | "company" | "flag";
  variation: string;
  history: "current" | "historical";
  formats: { type: string; url?: string; path?: string }[];
  origin: string | null;
  headquarters: string | null;
  markets: string[];
  categories: string[];
  region?: string;
  status: string;
  provenance: string;
  sourceUrl: string;
  website?: string;
  license?: string;
  preview?: string;
  distribution: string[];
  actions: string[];
};
export const filterKeys = [
  "kind",
  "collection",
  "format",
  "origin",
  "headquarters",
  "market",
  "category",
  "status",
  "provenance",
  "history",
  "distribution",
  "region",
] as const;
export type FilterKey = (typeof filterKeys)[number];
export type ResourceFilters = Partial<Record<FilterKey, string[]>> & {
  query?: string;
  sort?: string;
  page?: number;
};
export function valuesFor(r: AdminResource, key: FilterKey): string[] {
  switch (key) {
    case "format":
      return r.formats.map((f) => f.type);
    case "origin":
      return [r.origin ?? "unknown"];
    case "headquarters":
      return [r.headquarters ?? "unknown"];
    case "market":
      return r.markets.length ? r.markets : ["unknown"];
    case "category":
      return r.categories;
    case "distribution":
      return r.distribution;
    default:
      return [String(r[key] ?? "unknown")];
  }
}
export function filterResources(
  resources: AdminResource[],
  filters: ResourceFilters,
) {
  const query = (filters.query ?? "").normalize("NFKD").toLowerCase().trim();
  return resources
    .filter(
      (r) =>
        (!query ||
          [r.id, r.slug, r.name, ...r.aliases]
            .join(" ")
            .normalize("NFKD")
            .toLowerCase()
            .includes(query)) &&
        filterKeys.every(
          (key) =>
            !filters[key]?.length ||
            filters[key]!.some((value) => valuesFor(r, key).includes(value)),
        ),
    )
    .sort((a, b) =>
      filters.sort === "name-desc"
        ? b.name.localeCompare(a.name)
        : a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
}
export function readFilters(search: string): ResourceFilters {
  const params = new URLSearchParams(search);
  const filters: ResourceFilters = {
    query: params.get("q") ?? "",
    sort: params.get("sort") ?? "name",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
  for (const key of filterKeys) filters[key] = params.getAll(key);
  return filters;
}
export function writeFilters(filters: ResourceFilters, search = "") {
  const params = new URLSearchParams(search);
  for (const key of filterKeys) {
    params.delete(key);
    for (const value of filters[key] ?? []) params.append(key, value);
  }
  for (const [key, value] of [
    ["q", filters.query],
    ["sort", filters.sort],
    ["page", String(filters.page ?? 1)],
  ] as [string, string | undefined][]) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params.toString();
}
