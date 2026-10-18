import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import V2App from "./V2App";
import V2BrandCard from "./V2BrandCard";
import { logos } from "./v2-brand-data";
import affiliations from "../../../packages/brands/research/affiliations.json";
import { recommendBrands } from "./browse-tools";

afterEach(() => vi.unstubAllGlobals());
describe("V2 browse integration", () => {
  it("renders 20 default results with accessible pagination and shortcuts", () => {
    vi.stubGlobal("location", { pathname:"/v2", search:"" });
    vi.stubGlobal("localStorage", { getItem:() => null });
    vi.stubGlobal("matchMedia", () => ({ matches:false }));
    const $ = load(renderToStaticMarkup(<V2App />));
    expect($(".v2-grid > article")).toHaveLength(20);
    expect($(".v2-pagination button[aria-current=page]").text()).toBe("1");
    expect($(".v2-pagination").text()).toContain(`1–20 of ${logos.length}`);
    expect($('input[aria-keyshortcuts="/"]')).toHaveLength(1);
    expect($('[aria-keyshortcuts="Alt+R"]')).toHaveLength(1);
    expect($('[aria-keyshortcuts="Alt+B"]')).toHaveLength(1);
  });
  it("shares historical artwork, labels and busy guards between result sections", () => {
    const brand = logos.find((entry) => entry.slug === "t2-mobile")!;
    const $ = load(renderToStaticMarkup(<V2BrandCard logo={brand} query="9 mobile" busy reason="Similar name" onOpen={() => {}} onPack={() => {}} />));
    expect($("img").attr("alt")).toBe("9mobile logo");
    expect($("small").text()).toBe("Similar name");
    expect($('button[title="Pack into bag"]').is(":disabled")).toBe(true);
  });
  it("has valid sourced affiliation metadata and recommends the linked company", () => {
    for (const entry of affiliations) {
      expect(new URL(entry.source_url).protocol).toBe("https:");
      expect(entry.slugs.every((slug) => logos.some((brand) => brand.slug === slug))).toBe(true);
    }
    const matches = logos.filter((brand) => brand.slug === "sonatel");
    expect(recommendBrands(logos, matches, "Sonatel", affiliations)[0]).toMatchObject({ brand:{ slug:"orange-cote-d-ivoire" }, related:true });
  });
});
