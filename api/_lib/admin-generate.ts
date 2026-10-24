import sharp from "sharp";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import {
  readRepositoryFile,
  readRepositoryJson,
  type FileChange,
} from "./github.js";
import { expansionCatalogSchema } from "../../packages/brands/schema.js";
type Row = Record<string, any>;
const pretty = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2) + "\n");
// Generate the same affected artifacts as brands:publish, without executing repository code.
export async function generateAdminOutputs(
  changes: FileChange[],
  slug: string,
  token?: string,
) {
  const files = new Map(changes.map((c) => [c.path, c.content]));
  const bytes = async (path: string) =>
    files.has(path) ? files.get(path)! : readRepositoryFile(path, token);
  const json = async (path: string) =>
    files.has(path)
      ? JSON.parse(files.get(path)!.toString())
      : readRepositoryJson<any>(path, token);
  const put = (path: string, content: Buffer) => {
    files.set(path, content);
  };
  async function formats(
    source: Buffer,
    repositoryPath: string,
    types: string[],
    withoutEnlargement = false,
    historical = false,
  ) {
    const result = [];
    for (const type of types) {
      const render = sharp(source, { density: 144 }).resize({
        width: 1024,
        height: 512,
        fit: "inside",
        ...(historical && types.includes("svg") ? {} : { withoutEnlargement }),
      });
      const output =
        type === "svg"
          ? source
          : type === "png"
            ? await render.png().toBuffer()
            : await render
                .webp(
                  historical
                    ? { lossless: true }
                    : { lossless: true, effort: 3 },
                )
                .toBuffer();
      const hash = createHash("sha256").update(output).digest("hex");
      const meta = await sharp(output).metadata();
      const url = `/catalog/v2/assets/${hash}.${type}`;
      put(`apps/web/public${url}`, output);
      result.push({
        type,
        url,
        checksum: hash,
        mime_type: type === "svg" ? "image/svg+xml" : `image/${type}`,
        width: meta.width,
        height: meta.height,
        repository_path: repositoryPath,
      });
    }
    return result;
  }
  if (files.has("packages/brands/research/reviews.json")) {
    const [research, reviews, catalog, compatibility] = await Promise.all([
      json("packages/brands/research/manifest.json"),
      json("packages/brands/research/reviews.json"),
      json("packages/brands/catalog.json"),
      json("packages/brands/research/raster-scale-compatibility.json"),
    ]);
    const entry = research.entries.find((r: Row) => r.slug === slug);
    const review = reviews.find((r: Row) => r.slug === slug);
    const old = catalog.brands.find((r: Row) => r.slug === slug);
    let brand: Row | undefined;
    if (review.decision === "approved") {
      const asset = entry.candidate_assets.find(
        (a: Row) => a.path === review.asset_path,
      );
      const approved = `assets/${asset.checksum}.${asset.format}`;
      let source =
        (await bytes(`packages/brands/${approved}`).catch(() => null)) ??
        (await bytes(`packages/brands/${asset.path}`));
      if (!source) throw new Error("Source artwork unavailable");
      if (createHash("sha256").update(source).digest("hex") !== asset.checksum)
        throw new Error("Source checksum mismatch");
      put(`packages/brands/${approved}`, source);
      if (asset.format === "svg") {
        const $ = load(source.toString("utf8"), { xmlMode: true });
        $("svg").attr("xmlns", "http://www.w3.org/2000/svg");
        source = Buffer.from($.xml($("svg").first()));
      }
      if (review.trim_padding === true && asset.format !== "svg")
        source = await sharp(source).trim({ threshold: 4 }).png().toBuffer();
      const normalized = review.raster_normalization;
      if (asset.format !== "svg" && normalized?.original_checksum === asset.checksum) {
        if (!/^assets\/[a-f0-9]{64}\.png$/.test(normalized.path)) throw new Error("Invalid normalized raster path");
        source = await bytes(`packages/brands/${normalized.path}`);
        if (!source) throw new Error("Normalized raster unavailable");
        if (createHash("sha256").update(source).digest("hex") !== normalized.path.slice(7, -4)) throw new Error("Normalized raster checksum mismatch");
      }
      const sourceType = review.source_type || asset.source_type;
      brand = {
        preview_background: review.preview_background || "light",
        slug: entry.slug,
        name: entry.name,
        aliases: review.aliases ?? entry.aliases ?? [],
        industry: entry.industry,
        origin_country: review.origin_country ?? null,
        headquarters_country: review.headquarters_country ?? null,
        operating_countries: review.operating_countries,
        website: review.website || entry.website,
        source_url: asset.discovered_on,
        source_type: sourceType,
        status:
          sourceType === "community-catalog" ? "needs-review" : "verified",
        added_at: review.reviewed_at,
        updated_at: review.reviewed_at,
        reviewed_at: review.reviewed_at,
        reviewer: review.reviewer,
        review_notes: review.review_notes,
        evidence: review.evidence,
        batch: review.batch || "africa-100-01",
        formats: await formats(
          source,
          approved,
          [...(asset.format === "svg" ? ["svg"] : []), "png", "webp"],
          review.without_enlargement === true ||
            (asset.format !== "svg" &&
              compatibility[review.slug] !== asset.checksum),
        ),
      };
    }
    catalog.brands = catalog.brands.filter((b: Row) => b.slug !== slug);
    if (brand) catalog.brands.push(brand);
    catalog.brands.sort((a: Row, b: Row) => a.slug.localeCompare(b.slug));
    expansionCatalogSchema.parse(catalog);
    const published = pretty(catalog);
    put("packages/brands/catalog.json", published);
    put("apps/web/public/catalog/v2/brands.json", published);
    const dispositions = research.entries.map((e: Row) => {
      const r = reviews.find((r: Row) => r.slug === e.slug);
      return {
        ...e,
        disposition: r?.decision || e.disposition,
        reason: r?.review_notes || e.reason,
      };
    });
    const report = `# African Brand Expansion: ${research.entries.length} Candidates\n\nExisting logos are unchanged. ${catalog.brands.length} additions approved for V2 only.\n\n| Company | Target market | Industry | Disposition | Notes | Official source |\n|---|---|---|---|---|---|\n${dispositions.map((e: Row) => `| ${e.name} | ${e.target_market} | ${e.industry} | ${e.disposition} | ${e.reason.replaceAll("|", "/")} | ${e.sources.map((s: Row) => s.url).join(", ")} |`).join("\n")}\n`;
    put("packages/brands/research/source-report.md", Buffer.from(report));
  }
  if (files.has("packages/brands/research/historical-assets.json")) {
    const reviews = await json(
      "packages/brands/research/historical-assets.json",
    );
    const variations = [];
    for (const review of reviews) {
      const source = await bytes(`packages/brands/${review.source_path}`);
      if (!source) throw new Error("Historical source unavailable");
      if (
        createHash("sha256").update(source).digest("hex") !==
        review.source_checksum
      )
        throw new Error("Historical checksum mismatch");
      variations.push({
        ...review,
        formats: await formats(
          source,
          review.source_path,
          [
            ...(review.source_path.endsWith(".svg") ? ["svg"] : []),
            "png",
            "webp",
          ],
          !review.source_path.endsWith(".svg"),
          true,
        ),
      });
    }
    put("packages/brands/historical-catalog.json", pretty({ variations }));
  }
  return [...files].map(([path, content]) => ({ path, content }));
}
