import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import V2Flags from "./V2Flags";
import V2Pagination from "./V2Pagination";
import V2App from "./V2App";
import { flags, findFlags } from "./flags-data";
import { recommendBrands } from "./browse-tools";

afterEach(() => vi.unstubAllGlobals());
describe("flag browsing parity", () => {
  it("shows twenty flags with accessible windowed pagination and search", () => {
    const $ = load(renderToStaticMarkup(<V2Flags onSelect={() => {}} onAdd={() => {}} />));
    expect($(".v2-grid article")).toHaveLength(20);
    expect($(".v2-pagination button").map((_, el) => $(el).attr("aria-label")).get()).toEqual(["First page", "Previous page", "Page 1", "Page 2", "Page 3", "Next page", "Last page"]);
    expect($(".v2-pagination p").text()).toBe(`1–20 of ${flags.length}`);
    expect($('[aria-keyshortcuts="/"]')).toHaveLength(1);
  });
  it("shares disabled packing and contextual navigation search", () => {
    const $ = load(renderToStaticMarkup(<V2Flags busy onSelect={() => {}} onAdd={() => {}} />));
    expect($('button[title="Pack into bag"]:disabled')).toHaveLength(20);
    vi.stubGlobal("location", { pathname:"/v2/flags", search:"" });
    vi.stubGlobal("localStorage", { getItem:() => null });
    vi.stubGlobal("matchMedia", () => ({ matches:false }));
    const app = load(renderToStaticMarkup(<V2App />));
    expect(app('nav button[aria-label="Search flags"]')).toHaveLength(1);
    expect(app('nav button[aria-label="Search brands"]')).toHaveLength(0);
  });
  it("matches country codes and normalized names and scopes name suggestions", () => {
    expect(findFlags(" ng ", "all").some((flag) => flag.code === "NG")).toBe(true);
    expect(findFlags("aland", "all").some((flag) => flag.code === "AX")).toBe(true);
    const candidates = findFlags("", "Africa").map((flag) => ({ ...flag, slug:flag.code, aliases:[flag.code] }));
    const suggestions = recommendBrands(candidates, [], "Nigreia", []);
    expect(suggestions.some(({ brand }) => brand.code === "NG")).toBe(true);
    expect(suggestions.every(({ brand, related }) => brand.region === "Africa" && !related)).toBe(true);
  });
  it("hides unnecessary pagination and bounds the current page window", () => {
    expect(renderToStaticMarkup(<V2Pagination current={1} pages={1} start={1} end={2} total={2} onChange={() => {}} />)).toBe("");
    const $ = load(renderToStaticMarkup(<V2Pagination current={8} pages={13} start={141} end={160} total={250} onChange={() => {}} />));
    expect($('[aria-label^="Page "]').map((_, el) => $(el).text()).get()).toEqual(["5", "6", "7", "8", "9", "10"]);
  });
});
