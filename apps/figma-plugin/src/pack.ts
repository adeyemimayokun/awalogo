export const PACK_KEY = "awalogo:plugin-pack:v1";
export type PackEntry = { slug: string; name: string; format?: "svg" | "png" | "webp" | "jpeg" };

export function parsePack(value: string | null): PackEntry[] {
  try {
    const entries: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(entries)) return [];
    const seen = new Set<string>();
    return entries.filter((entry): entry is PackEntry => {
      if (!entry || typeof entry !== "object" || typeof entry.slug !== "string" || !/^[a-z0-9-]{1,160}$/.test(entry.slug) || typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > 240 || (entry.format !== undefined && !["svg", "png", "webp", "jpeg"].includes(entry.format))) return false;
      const identity = `${entry.slug}:${entry.format ?? "default"}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    }).slice(0, 50).map(({ slug, name, format }) => format ? { slug, name, format } : { slug, name });
  } catch { return []; }
}
export function readPack() {
  try { return parsePack(localStorage.getItem(PACK_KEY)); } catch { return []; }
}
