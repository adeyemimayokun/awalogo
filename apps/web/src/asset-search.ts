import { findFlags } from "./flags-data";

export function searchFlagResults(query: string, market = "") {
  if (!query.trim()) return [];
  return findFlags(query, "all").filter(flag => !market || flag.code === market);
}
