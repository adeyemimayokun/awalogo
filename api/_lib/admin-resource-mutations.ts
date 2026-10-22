import { generateAdminOutputs } from "./admin-generate.js";
import { z } from "zod";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { load } from "cheerio";
import { industries } from "../../packages/brands/schema.js";
import {
  readRepositoryJson,
  readRepositoryFile,
  type FileChange,
} from "./github.js";
const https = z
  .string()
  .url()
  .max(2048)
  .refine((v) => {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password;
  });
const code = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .nullable();
const schema = z
  .object({
    collection: z.enum(["company", "flag", "editorial"]),
    slug: z
      .string()
      .regex(/^[a-zA-Z0-9-]+$/)
      .max(160),
    variation: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .default("primary"),
    operation: z.enum([
      "edit",
      "replace",
      "archive",
      "remove",
      "verify",
      "edit-flag",
      "save-editorial",
    ]),
    confirmation: z.string().default(""),
    name: z.string().trim().min(2).max(160).optional(),
    aliases: z.array(z.string().max(160)).max(30).optional(),
    industry: z.enum(industries).optional(),
    origin: code.optional(),
    headquarters: code.optional(),
    markets: z
      .array(z.string().regex(/^[A-Z]{2}$/))
      .min(1)
      .max(249)
      .optional(),
    sourceUrl: https.optional(),
    sourceType: z
      .enum([
        "official-website",
        "official-brand-page",
        "annual-report",
        "verified-pdf",
        "community-catalog",
      ])
      .optional(),
    website: https.optional(),
    notes: z.string().trim().min(10).max(2000),
    file: z
      .object({
        base64: z.string().min(1).max(2800000),
        type: z.enum(["svg", "png", "webp", "jpeg"]),
      })
      .strict()
      .optional(),
    region: z.string().trim().min(2).max(80).optional(),
    editorial: z.unknown().optional(),
  })
  .strict();
type Row = Record<string, any>;
const pretty = (value: unknown) =>
  Buffer.from(JSON.stringify(value, null, 2) + "\n");
export async function prepareResourceMutation(
  body: unknown,
  login: string,
  token?: string,
) {
  const b = schema.parse(body);
  const changes: FileChange[] = [];
  const today = new Date().toISOString().slice(0, 10);
  if (["archive", "remove"].includes(b.operation) && b.confirmation !== b.slug)
    throw new Error("Confirmation must match the resource slug");
  const json = async (path: string) => readRepositoryJson<any>(path, token);
  if (b.collection === "editorial") {
    if (b.operation !== "save-editorial")
      throw new Error("Invalid editorial action");
    const entry = z
      .object({
        updates: z.array(
          z
            .object({
              id: z.string().min(1),
              title: z.string().min(2),
              summary: z.string().min(10),
              published_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              action_label: z.string(),
              action_href: z
                .string()
                .refine((v) => v.startsWith("/v2") && !v.startsWith("//")),
              status: z.enum(["draft", "published"]),
            })
            .strict(),
        ),
        changelog: z.array(
          z
            .object({
              version: z.string().min(1),
              date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              title: z.string().min(2),
              status: z.enum(["draft", "published"]),
              changes: z.array(z.string().min(1)).min(1),
            })
            .strict(),
        ),
      })
      .strict()
      .parse(b.editorial);
    changes.push({
      path: "apps/web/src/v2-editorial.json",
      content: pretty(entry),
    });
  } else if (b.collection === "flag") {
    if (b.operation !== "edit-flag")
      throw new Error("Flag artwork must use the pinned importer");
    const flags = await json("apps/web/src/generated/flags.json");
    if (!flags.countries.some((f: Row) => f.code === b.slug))
      throw new Error("Flag not found");
    const overrides = await json("packages/brands/flag-metadata.json");
    overrides[b.slug] = {
      name: b.name,
      region: b.region,
      reviewer: login,
      reviewed_at: today,
      notes: b.notes,
    };
    changes.push({
      path: "packages/brands/flag-metadata.json",
      content: pretty(overrides),
    });
  } else {
    const [manifest, reviews, historical] = await Promise.all([
      json("packages/brands/research/manifest.json"),
      json("packages/brands/research/reviews.json"),
      json("packages/brands/research/historical-assets.json"),
    ]);
    const entry = manifest.entries.find((r: Row) => r.slug === b.slug);
    const review = reviews.find((r: Row) => r.slug === b.slug);
    const h = historical.find(
      (r: Row) => r.slug === b.slug && r.id === b.variation,
    );
    if (b.variation !== "primary") {
      if (!h) throw new Error("Historical artwork not found");
      if (!["edit", "replace", "remove"].includes(b.operation))
        throw new Error("Unsupported historical action");
      if (b.operation === "remove") historical.splice(historical.indexOf(h), 1);
      else {
        if (b.name) h.name = b.name;
        if (b.sourceUrl) h.source_url = b.sourceUrl;
        h.review_notes = b.notes;
        h.reviewer = login;
        h.reviewed_at = today;
      }
      if (b.file) {
        const bytes = await safeArtwork(b.file);
        const hash = createHash("sha256").update(bytes).digest("hex");
        h.source_path = `assets/${b.slug}-${b.variation}-${hash.slice(0, 12)}.${b.file.type}`;
        h.source_checksum = hash;
        changes.push({
          path: `packages/brands/${h.source_path}`,
          content: bytes,
        });
      }
      changes.push({
        path: "packages/brands/research/historical-assets.json",
        content: pretty(historical),
      });
    } else {
      if (!entry || !review) throw new Error("Company not found");
      if (
        b.operation === "edit" ||
        b.operation === "verify" ||
        b.operation === "replace"
      ) {
        if (b.name) entry.name = b.name;
        if (b.industry) entry.industry = b.industry;
        if (b.aliases) {
          entry.aliases = b.aliases;
          review.aliases = b.aliases;
        }
        if (b.origin !== undefined) review.origin_country = b.origin;
        if (b.headquarters !== undefined)
          review.headquarters_country = b.headquarters;
        if (b.markets) {
          review.operating_countries = b.markets;
          if (!b.markets.includes(entry.target_market))
            throw new Error(
              "Operating markets must include the researched target market",
            );
        }
        if (b.website) review.website = b.website;
        review.reviewer = login;
        review.reviewed_at = today;
        review.review_notes = b.notes;
        const candidate = entry.candidate_assets.find(
          (a: Row) => a.path === review.asset_path,
        );
        if (!candidate) throw new Error("Source asset not found");
        if (b.sourceUrl) candidate.discovered_on = b.sourceUrl;
        if (b.sourceType) review.source_type = b.sourceType;
        if (
          b.operation === "verify" &&
          (!b.sourceUrl ||
            !b.sourceType ||
            b.sourceType === "community-catalog")
        )
          throw new Error(
            "Verification requires an official source URL and type",
          );
        if (b.file) {
          const bytes = await safeArtwork(b.file);
          const hash = createHash("sha256").update(bytes).digest("hex");
          const path = `staging/${b.slug}-admin-${hash.slice(0, 12)}.${b.file.type}`;
          const meta = await sharp(bytes).metadata();
          entry.candidate_assets.push({
            ...candidate,
            path,
            format: b.file.type,
            checksum: hash,
            width: meta.width,
            height: meta.height,
            source_type:
              b.sourceType ?? review.source_type ?? candidate.source_type,
            discovered_on: b.sourceUrl ?? candidate.discovered_on,
          });
          review.asset_path = path;
          changes.push({ path: `packages/brands/${path}`, content: bytes });
        }
        if (b.operation === "replace" && !b.file)
          throw new Error("Replacement artwork is required");
        if (b.operation === "replace") {
          const old = await json("packages/brands/catalog.json");
          const current = old.brands.find((r: Row) => r.slug === b.slug);
          const source = current?.formats[0]?.repository_path;
          if (source) {
            const archivedAsset =
              current.formats.find((f: Row) => f.type === "svg") ??
              current.formats.find((f: Row) => f.type === "png");
            const bytes = await readRepositoryFile(
              `apps/web/public${archivedAsset.url}`,
              token,
            );
            if (bytes) {
              const id = `previous-${today}-${createHash("sha256").update(bytes).digest("hex").slice(0, 8)}`;
              if (historical.some((h: Row) => h.slug === b.slug && h.id === id))
                throw new Error("This artwork is already archived");
              changes.push({
                path: `packages/brands/assets/${id}.${archivedAsset.type}`,
                content: bytes,
              });
              historical.push({
                slug: b.slug,
                id,
                name: `Previous logo (${today})`,
                brand_name: current.name,
                status: current.status,
                variation_status: "old",
                source_type: current.source_type,
                source_path: `assets/${id}.${archivedAsset.type}`,
                source_checksum: createHash("sha256")
                  .update(bytes)
                  .digest("hex"),
                source_url: current.source_url,
                identity_evidence: current.website,
                reviewer: login,
                reviewed_at: today,
                visual_reviewed: true,
                review_notes: `Archived from the previously reviewed primary artwork. ${b.notes}`,
              });
              changes.push({
                path: "packages/brands/research/historical-assets.json",
                content: pretty(historical),
              });
            }
          }
        }
      } else if (["archive", "remove"].includes(b.operation)) {
        review.decision = b.operation === "archive" ? "archived" : "removed";
        review.review_notes = b.notes;
      } else throw new Error("Unsupported company action");
      changes.push(
        {
          path: "packages/brands/research/manifest.json",
          content: pretty(manifest),
        },
        {
          path: "packages/brands/research/reviews.json",
          content: pretty(reviews),
        },
      );
    }
  }
  return {
    action: b.operation,
    slug: b.slug,
    title: `admin: ${b.operation} ${b.collection} ${b.slug}`,
    body: `${b.notes}\n\nSubmitted by @${login}. Pending review, regeneration, deployment, and deployed-catalog verification. Generated source records and public outputs are included; validate with pnpm brands:check before merging.`,
    changes: await generateAdminOutputs(changes, b.slug, token),
  };
}
export async function safeArtwork(file: {
  base64: string;
  type: string;
}): Promise<Buffer> {
  let bytes = Buffer.from(file.base64, "base64");
  if (!bytes.length || bytes.length > 2000000)
    throw new Error("Artwork must be under 2 MB");
  if (file.type === "svg") {
    const text = bytes.toString("utf8");
    if (/<!DOCTYPE|<!ENTITY/i.test(text))
      throw new Error("Unsafe SVG declaration");
    const $ = load(text, { xmlMode: true });
    if (
      $("svg").length !== 1 ||
      !$("svg").attr("viewBox") ||
      $("script,foreignObject,iframe,image,style,animate,set").length
    )
      throw new Error("Unsafe SVG");
    for (const el of $("*").toArray())
      for (const [k, v] of Object.entries(
        ("attribs" in el ? el.attribs : {}) as Record<string, string>,
      ))
        if (
          /^on/i.test(k) ||
          (/href|src/i.test(k) && !v.startsWith("#")) ||
          (/url\(/i.test(v) && /url\(\s*["']?(?!#)/i.test(v))
        )
          throw new Error("Unsafe SVG reference");
    bytes = Buffer.from($.xml($("svg")));
  }
  const meta = await sharp(bytes, { limitInputPixels: 40000000 }).metadata();
  if (
    meta.format !==
    (
      { svg: "svg", png: "png", webp: "webp", jpeg: "jpeg" } as Record<
        string,
        string
      >
    )[file.type]
  )
    throw new Error("Artwork content does not match its format");
  return bytes;
}
