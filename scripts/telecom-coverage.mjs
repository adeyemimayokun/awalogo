import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = resolve("packages/brands/research");
const read = async (name) => JSON.parse(await readFile(resolve(base, name), "utf8"));
const [manifest, reviews, catalog] = await Promise.all([
  read("manifest.json"), read("reviews.json"),
  readFile(resolve("packages/brands/catalog.json"), "utf8").then(JSON.parse)
]);
const available = new Set(catalog.brands.map((brand) => brand.slug));
const entries = manifest.entries.filter((entry) => entry.industry === "telecommunications").map((entry) => {
  const review = reviews.find((item) => item.slug === entry.slug);
  return {
    slug: entry.slug, name: entry.name, target_market: entry.target_market,
    status: available.has(entry.slug) ? "available" : review?.decision ?? entry.disposition,
    website: review?.website ?? entry.sources[0]?.url ?? entry.website,
    staged_artwork: entry.candidate_assets.length,
    note: review?.review_notes ?? entry.reason
  };
}).sort((a, b) => a.target_market.localeCompare(b.target_market) || a.name.localeCompare(b.name));
const summary = entries.reduce((counts, entry) => ({ ...counts, [entry.status]: (counts[entry.status] ?? 0) + 1 }), {});
const data = { scope: "Reviewed V2 expansion inventory; not an exhaustive census of licensed African telecom operators.", summary, entries };
const json = `${JSON.stringify(data, null, 2)}\n`;
const report = `# Telecom Coverage\n\n${data.scope}\n\n${entries.length} brands tracked. ${summary.available ?? 0} available in V2. Existing logos and V1 are unchanged. Unresolved and pending candidates are not published.\n\n| Brand | Target market | Status | Staged artwork | Source |\n|---|---|---|---|---|\n${entries.map((entry) => `| ${entry.name} | ${entry.target_market} | ${entry.status} | ${entry.staged_artwork} | ${entry.website} |`).join("\n")}\n`;
for (const [name, text] of [["telecom-coverage.json", json], ["telecom-coverage.md", report]]) {
  const path = resolve(base, name);
  if (process.argv.includes("--check")) {
    if (await readFile(path, "utf8") !== text) throw new Error(`Stale telecom coverage: ${name}`);
  } else await writeFile(path, text);
}
console.log(JSON.stringify(summary));
