import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin } from "../_lib/auth.js";
import { catalogPaths } from "../_lib/catalog.js";
import { isLocalRepositoryMode, readRepositoryJson } from "../_lib/github.js";
import { jsonError, methodNotAllowed } from "../_lib/http.js";

const coreEntries = [
  { name: "Moniepoint", slug: "moniepoint", category: "microfinance-bank", website: "https://moniepoint.com/", source_url: "https://moniepoint.com/icon.svg", svg_path: "assets/moniepoint.svg", formats: [{ type: "svg", path: "assets/moniepoint.svg" }, { type: "png", path: "assets/moniepoint.png" }, { type: "webp", path: "assets/moniepoint.webp" }], status: "verified" },
  { name: "OPay", slug: "opay", category: "fintech", website: "https://www.opayweb.com/", source_url: "https://gstatic.opayweb.com/website-ng/img/opay-logo.684aa98.svg", svg_path: "assets/opay.svg", formats: [{ type: "svg", path: "assets/opay.svg" }, { type: "png", path: "assets/opay.png" }, { type: "webp", path: "assets/opay.webp" }], status: "verified" },
  { name: "Flutterwave", slug: "flutterwave", category: "fintech", website: "https://flutterwave.com/ng/", source_url: "https://flutterwave.com/images/logo/full.svg", svg_path: "assets/flutterwave.svg", formats: [{ type: "svg", path: "assets/flutterwave.svg" }, { type: "png", path: "assets/flutterwave.png" }, { type: "webp", path: "assets/flutterwave.webp" }], status: "verified" }
];

type PreviewEntry = {
  svg_path?: string | null;
  formats?: Array<{ type: string; path: string }>;
  [key: string]: unknown;
};

function withLocalPreview<T extends PreviewEntry>(entry: T): T & { preview_url?: string } {
  if (!isLocalRepositoryMode()) return entry;
  const asset = entry.svg_path ?? entry.formats?.find((format) => format.type === "png")?.path ??
    entry.formats?.find((format) => format.type === "webp")?.path;
  return asset
    ? { ...entry, preview_url: `/api/admin/local-asset?path=${encodeURIComponent(`packages/logos/src/${asset}`)}` }
    : entry;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
  if (!requireAdmin(request, response)) return;
  response.setHeader("Cache-Control", "no-store");
  try {
    const [catalog, variations] = await Promise.all([
      readRepositoryJson(catalogPaths.catalog),
      readRepositoryJson(catalogPaths.variations)
    ]);
    const previewCatalog = [...coreEntries, ...(catalog as PreviewEntry[])].map(withLocalPreview);
    const previewVariations = Object.fromEntries(
      Object.entries(variations as Record<string, PreviewEntry[]>)
        .map(([slug, items]) => [slug, items.map(withLocalPreview)])
    );
    response.status(200).json({
      catalog: previewCatalog,
      variations: previewVariations,
      lockedSlugs: coreEntries.map((entry) => entry.slug),
      localPreview: isLocalRepositoryMode()
    });
  } catch (error) {
    jsonError(response, error);
  }
}
