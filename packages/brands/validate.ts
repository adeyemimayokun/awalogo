import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import catalog from "./catalog.json";
import { expansionCatalogSchema } from "./schema";

const parsed = expansionCatalogSchema.parse(catalog);
const slugs = new Set<string>();
for (const brand of parsed.brands) {
  if (slugs.has(brand.slug)) throw new Error(`Duplicate V2 brand: ${brand.slug}`);
  slugs.add(brand.slug);
  for (const asset of brand.formats) {
    const bytes = readFileSync(`apps/web/public${asset.url}`);
    if (createHash("sha256").update(bytes).digest("hex") !== asset.checksum) throw new Error(`V2 asset checksum mismatch: ${brand.slug}`);
  }
}
console.log(`Validated ${parsed.brands.length} independent V2 brands and all public asset checksums.`);
