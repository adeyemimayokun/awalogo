import { createHash } from "node:crypto";
import { publishedRenderBaseline } from "./published-render-baseline.mjs";
import { validateSvgSecurity } from "../validator/svg-security.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
export function renderFingerprint(kind, checksum, format, options) {
  // Version these recipes whenever renderer settings/normalization code changes.
  return hash(JSON.stringify(stable({ recipe: `${kind}-144dpi-1024x512-inside-v1`, checksum, format, options })));
}
export function primaryRenderOptions(review, asset, compatibility) {
  return {
    trimPadding: review.trim_padding === true && asset.format !== "svg",
    withoutEnlargement: review.without_enlargement === true || (asset.format !== "svg" && compatibility[review.slug] !== asset.checksum),
    normalization: asset.format !== "svg" && review.raster_normalization?.original_checksum === asset.checksum ? review.raster_normalization.path : null,
  };
}
export function formatsFingerprint(formats) { return hash(JSON.stringify(stable(formats))); }

/** Reuse only pinned, already-published outputs. Missing/corrupt bytes fail closed. */
export async function cachedPublishedFormats(key, fingerprint, formats, read, normalization = null) {
  const baseline = publishedRenderBaseline[key];
  if (!baseline || baseline.input !== fingerprint || !formats || baseline.output !== formatsFingerprint(formats)) return null;
  if (normalization) {
    if (!/^assets\/[a-f0-9]{64}\.png$/.test(normalization)) throw new Error("Invalid normalized raster path");
    const normalized = await read(`packages/brands/${normalization}`);
    if (!normalized || hash(normalized) !== normalization.slice(7, -4)) throw new Error("Normalized raster checksum mismatch");
  }
  const outputs = [];
  for (const format of formats) {
    if (!/^[a-f0-9]{64}$/.test(format.checksum) || format.url !== `/catalog/v2/assets/${format.checksum}.${format.type}` || !["svg", "png", "webp"].includes(format.type)) throw new Error("Invalid published output reference");
    const path = `apps/web/public${format.url}`;
    const bytes = await read(path);
    if (!bytes || hash(bytes) !== format.checksum) throw new Error(`Published output checksum mismatch: ${path}`);
    if (format.type === "svg") validateSvgSecurity(bytes);
    outputs.push({ path, bytes });
  }
  return { formats, outputs };
}
