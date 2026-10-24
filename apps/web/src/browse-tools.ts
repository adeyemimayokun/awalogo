export const PAGE_SIZE = 20;
export function pageWindow(current: number, pages: number): number[] {
  const start = Math.max(1, current - 3);
  const end = Math.min(pages, current + 2);
  return Array.from({ length:Math.max(0, end - start + 1) }, (_, index) => start + index);
}
export function paginate<T>(items: T[], page: number) {
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(pages, Math.max(1, page));
  return { items: items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), pages, current, start: items.length ? (current - 1) * PAGE_SIZE + 1 : 0, end: Math.min(current * PAGE_SIZE, items.length) };
}
type Brand = { slug: string; name: string; aliases: string[] };
export type Affiliation = { slugs: string[]; source_url: string };
const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export function nameSimilarity(a: string, b: string) {
  const x = normalize(a), y = normalize(b);
  if (Math.min(x.length, y.length) < 3) return 0;
  let row = Array.from({ length: y.length + 1 }, (_, i) => i);
  let previous = row;
  for (let i = 1; i <= x.length; i++) {
    const next = [i];
    for (let j = 1; j <= y.length; j++) {
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) next[j] = Math.min(next[j], previous[j - 2] + 1);
    }
    previous = row;
    row = next;
  }
  return 1 - row[y.length] / Math.max(x.length, y.length);
}
export function recommendBrands<T extends Brand>(brands: T[], matches: T[], query: string, affiliations: Affiliation[]) {
  if (!query.trim()) return [];
  const direct = new Set(matches.map((brand) => brand.slug));
  const related = new Set(affiliations.filter((entry) => /^https:\/\//.test(entry.source_url) && entry.slugs.some((slug) => direct.has(slug))).flatMap((entry) => entry.slugs));
  return brands.filter((brand) => !direct.has(brand.slug)).map((brand) => ({ brand, related: related.has(brand.slug), score: Math.max(...[brand.name, ...brand.aliases].map((name) => nameSimilarity(query, name))) })).filter((entry) => entry.related || entry.score >= .65).sort((a, b) => Number(b.related) - Number(a.related) || b.score - a.score || a.brand.name.localeCompare(b.brand.name, "en") || a.brand.slug.localeCompare(b.brand.slug, "en")).slice(0, 8);
}
export function shortcut(event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "isComposing" | "repeat">, editing: boolean) {
  if (editing || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (!event.altKey && event.key === "/") return "search";
  if (event.altKey && event.key.toLowerCase() === "b") return "bag";
  if (event.altKey && event.key.toLowerCase() === "r") return "request";
}
