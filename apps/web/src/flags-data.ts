import overrides from '../../../packages/brands/flag-metadata.json';
import data from "./generated/flags.json";

export type FlagAsset = { type: "svg" | "png" | "webp"; url: string; checksum: string; mime_type: "image/svg+xml" | "image/png" | "image/webp"; width: number; height: number };
export type CountryFlag = { code: string; name: string; region: string; variants: Array<{ id: string; name: string; formats: FlagAsset[] }> };
export const flags = data.countries.map(flag=>({...flag,...((overrides as Record<string,{name?:string;region?:string}>)[flag.code]??{})})) as CountryFlag[];
export const flagSource = data.source;
export function flagForSlug(slug: string) { return slug.startsWith("flag-") ? flags.find((flag) => flag.code.toLowerCase() === slug.slice(5)) : undefined; }

export function findFlags(query: string, region: string): CountryFlag[] {
  const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const text = normalize(query);
  return flags.filter((flag) => (region === "all" || flag.region === region) && [flag.name, flag.code].some((value) => normalize(value).includes(text)));
}
