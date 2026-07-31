import type { VercelRequest, VercelResponse } from "@vercel/node";
import bundledCatalogJson from "../../packages/logos/src/promoted-catalog.json";
import bundledVariationsJson from "../../packages/logos/src/variations.json";
import { requireAdmin } from "../_lib/auth.js";
import { isLocalRepositoryMode, readRepositoryJson } from "../_lib/github.js";
import { jsonError, methodNotAllowed } from "../_lib/http.js";

const catalogPaths = {
  catalog: "packages/logos/src/promoted-catalog.json",
  variations: "packages/logos/src/variations.json"
};
const lockedSlugs = ["moniepoint", "opay", "flutterwave"];
const coreEntries: PreviewEntry[] = [
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

function bundledCatalogState(): {
  catalog: PreviewEntry[];
  variations: Record<string, PreviewEntry[]>;
} {
  return {
    catalog: [...coreEntries, ...(bundledCatalogJson as PreviewEntry[])],
    variations: bundledVariationsJson as Record<string, PreviewEntry[]>
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
  if (!requireAdmin(request, response)) return;
  response.setHeader("Cache-Control", "no-store");
  try {
    const state = isLocalRepositoryMode()
      ? await Promise.all([
          readRepositoryJson<PreviewEntry[]>(catalogPaths.catalog),
          readRepositoryJson<Record<string, PreviewEntry[]>>(catalogPaths.variations)
        ]).then(([catalog, variations]) => ({
          catalog: [
            ...bundledCatalogState().catalog.filter((entry) => lockedSlugs.includes(String(entry.slug))),
            ...catalog
          ],
          variations
        }))
      : bundledCatalogState();
    const previewCatalog = state.catalog.map(withLocalPreview);
    const previewVariations = Object.fromEntries(
      Object.entries(state.variations)
        .map(([slug, items]) => [slug, items.map(withLocalPreview)])
    );
    response.status(200).json({
      catalog: previewCatalog,
      variations: previewVariations,
      lockedSlugs,
      localPreview: isLocalRepositoryMode(),
      catalogSource: isLocalRepositoryMode() ? "local-worktree" : "deployment-bundle"
    });
  } catch (error) {
    jsonError(response, error);
  }
}
