import history from "../../../packages/brands/research/telecom-brand-history.json";

const histories = new Map(history.map((entry) => [entry.slug, entry]));
export function formerBrandName(slug: string): string | undefined {
  return histories.get(slug)?.former_names[0];
}

export function searchedHistoricalVersion<T extends { id: string; name: string; status?: string }>(variations: T[], query: string): T | undefined {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const text = normalize(query);
  return text ? variations.find((entry) => entry.status === "old" && normalize(entry.name) === text) : undefined;
}
