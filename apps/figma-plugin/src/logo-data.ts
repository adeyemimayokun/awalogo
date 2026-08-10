import type { LogoFormatType } from "@awalogo/core";
import {
  absoluteCatalogUrl,
  type RuntimeAsset,
  type RuntimeCatalog,
  type RuntimeLogo
} from "@awalogo/catalog-ui/runtime-catalog";

export type LogoAsset = {
  name: string;
  slug: string;
  formats: RuntimeAsset[];
  svg: string;
  asset_urls: Partial<Record<LogoFormatType, string>>;
};

export type LogoVariationWithSvg = RuntimeLogo["variations"][number] & {
  svg: string;
  asset_urls: Partial<Record<LogoFormatType, string>>;
};

export type LogoWithSvg = Omit<RuntimeLogo, "variations"> & LogoAsset & {
  variations: LogoVariationWithSvg[];
};

function assetUrls(formats: RuntimeAsset[], origin?: string) {
  return Object.fromEntries(formats.map((format) => [format.type, absoluteCatalogUrl(format.url, origin)]));
}

export function hydrateRuntimeLogos(catalog: RuntimeCatalog, origin?: string): LogoWithSvg[] {
  return catalog.items.map(({ logo }) => ({
    ...logo,
    svg: "",
    asset_urls: assetUrls(logo.formats, origin),
    variations: logo.variations.map((variation) => ({
      ...variation,
      svg: "",
      asset_urls: assetUrls(variation.formats, origin)
    }))
  }));
}
