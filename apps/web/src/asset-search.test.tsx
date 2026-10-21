import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { searchFlagResults } from "./asset-search";
import V2FlagCard from "./V2FlagCard";

describe("combined hero search", () => {
  it("keeps flags out of the default logo homepage", () => {
    expect(searchFlagResults("")).toEqual([]);
    expect(searchFlagResults("  ")).toEqual([]);
  });
  it("finds countries and codes and respects the operating-market filter", () => {
    expect(searchFlagResults("Nigeria").map(flag => flag.code)).toEqual(["NG"]);
    expect(searchFlagResults("FR").some(flag => flag.code === "FR")).toBe(true);
    expect(searchFlagResults("Nigeria", "KE")).toEqual([]);
    expect(searchFlagResults("Nigeria", "NG")).toHaveLength(1);
    expect(searchFlagResults("zzzzunmatched")).toEqual([]);
  });
  it("reuses flag preview and pack actions with the busy guard", () => {
    const flag = searchFlagResults("Nigeria")[0];
    const $ = load(renderToStaticMarkup(<V2FlagCard flag={flag} busy onSelect={() => {}} onAdd={() => {}} />));
    expect($("article[data-resource=flag]")).toHaveLength(1);
    expect($("img").attr("src")).toBe(flag.variants[0].formats[0].url);
    expect($('button[aria-label="Pack into bag: Nigeria"]').is(":disabled")).toBe(true);
  });
});
