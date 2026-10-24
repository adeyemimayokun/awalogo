import pendingCatalog from "../../packages/logos/src/promoted-catalog.json";
import flagMetadata from "../../packages/brands/flag-metadata.json";
import runtime from "../../packages/catalog-ui/src/generated/runtime-catalog.json";
import brands from "../../packages/brands/catalog.json";
import history from "../../packages/brands/historical-catalog.json";
import corrections from "../../packages/brands/asset-corrections.json";
import flags from "../../apps/web/src/generated/flags.json";
import markets from "../../packages/brands/research/telecom-market-coverage.json";
import type { AdminResource } from "../../packages/admin/resources.js";
export function adminResources(): AdminResource[] {
  const output: AdminResource[] = [];
  for (const item of runtime.items) {
    const logo = item.logo;
    const correction = corrections.corrections.find(
      (c) => c.slug === logo.slug,
    );
    const base = {
      slug: logo.slug,
      name: logo.name,
      aliases: logo.aliases ?? [],
      kind: "logo" as const,
      collection: "financial" as const,
      origin: null,
      headquarters: null,
      markets: [
        ...new Set([
          "NG",
          ...(markets.find((m) => m.slug === logo.slug)?.operating_countries ??
            []),
        ]),
      ],
      categories: logo.categories ?? [logo.category],
      status: logo.status,
      provenance: correction ? "official-website" : logo.source_type,
      sourceUrl: correction?.source_url ?? logo.source_url,
      website: logo.website,
      distribution: ["v1", "v2", "published-plugin"],
      actions: ["legacy-editor"],
    };
    output.push({
      ...base,
      id: `financial:${logo.slug}:primary`,
      variation: "primary",
      history: "current",
      formats: correction?.formats ?? logo.formats,
    });
    for (const v of logo.variations)
      output.push({
        ...base,
        id: `financial:${logo.slug}:${v.id}`,
        variation: v.id,
        name: `${logo.name} / ${v.name}`,
        history: "status" in v && v.status === "old" ? "historical" : "current",
        formats: v.formats,
        sourceUrl: v.source_url ?? logo.source_url,
      });
  }
  for (const b of brands.brands)
    output.push({
      id: `company:${b.slug}:primary`,
      slug: b.slug,
      name: b.name,
      aliases: b.aliases,
      kind: "logo",
      collection: "company",
      variation: "primary",
      history: "current",
      formats: b.formats,
      origin: b.origin_country,
      headquarters: b.headquarters_country,
      markets: b.operating_countries,
      categories: [b.industry],
      status: b.status,
      provenance: b.source_type,
      sourceUrl: b.source_url,
      website: b.website,
      distribution: ["v2", "plugin-compatibility"],
      actions: ["edit", "replace", "archive", "remove", "verify"],
    });
  for (const h of history.variations) {
    const b = brands.brands.find((b) => b.slug === h.slug);
    output.push({
      id: `company:${h.slug}:${h.id}`,
      slug: h.slug,
      name: `${h.brand_name} / ${h.name}`,
      aliases: [],
      kind: "logo",
      collection: "company",
      variation: h.id,
      history: "historical",
      formats: h.formats,
      origin: b?.origin_country ?? null,
      headquarters: b?.headquarters_country ?? null,
      markets: b?.operating_countries ?? [],
      categories: b ? [b.industry] : [],
      status: h.status,
      provenance: h.source_type,
      sourceUrl: h.source_url,
      distribution: ["v2", "plugin-compatibility"],
      actions: ["edit", "replace", "remove"],
    });
  }
  for (const raw of flags.countries)
    for (const v of raw.variants) {
      const f = {
        ...raw,
        ...((
          flagMetadata as Record<string, { name?: string; region?: string }>
        )[raw.code] ?? {}),
      };
      output.push({
        id: `flag:${f.code}:${v.id}`,
        slug: f.code,
        name: `${f.name} / ${v.name}`,
        aliases: [f.code, f.name],
        kind: "flag",
        collection: "flag",
        variation: v.id,
        history: "current",
        formats: v.formats,
        origin: f.code,
        headquarters: null,
        markets: [],
        categories: ["flags"],
        region: f.region,
        status: "licensed",
        provenance: "flag-icons@" + flags.version,
        sourceUrl: flags.source,
        license: flags.license,
        distribution: ["v2", "plugin-compatibility"],
        actions: ["edit-flag"],
      });
    }
  for (const logo of pendingCatalog) {
    if (
      output.some((r) => r.collection === "financial" && r.slug === logo.slug)
    )
      continue;
    output.push({
      id: `financial:${logo.slug}:primary`,
      slug: logo.slug,
      name: logo.name,
      aliases: logo.aliases ?? [],
      kind: "logo",
      collection: "financial",
      variation: "primary",
      history: "current",
      formats: logo.formats,
      origin: null,
      headquarters: null,
      markets: ["NG"],
      categories: logo.categories ?? [logo.category],
      status: logo.status,
      provenance: logo.source_type,
      sourceUrl: logo.source_url,
      website: logo.website,
      distribution: ["repository"],
      actions: ["legacy-editor"],
    });
  }
  return output;
}
