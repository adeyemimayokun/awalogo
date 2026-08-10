import type { LogoFormatType } from "@awalogo/core";
import generatedRuntimeCatalog from "./generated/runtime-catalog.json";
import {
  parseRuntimeCatalog,
  type RuntimeAsset,
  type RuntimeLogo
} from "./runtime-catalog";

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

function assetUrls(formats: RuntimeAsset[]) {
  return Object.fromEntries(formats.map((format) => [format.type, format.url]));
}

export const runtimeCatalog = parseRuntimeCatalog(generatedRuntimeCatalog);

export const logos: LogoWithSvg[] = runtimeCatalog.items.map(({ logo }) => ({
  ...logo,
  svg: "",
  asset_urls: assetUrls(logo.formats),
  variations: logo.variations.map((variation) => ({
    ...variation,
    svg: "",
    asset_urls: assetUrls(variation.formats)
  }))
}));
