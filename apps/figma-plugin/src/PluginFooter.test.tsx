import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { PluginFooter } from "./PluginFooter";

describe("plugin footer", () => {
  const $ = load(renderToStaticMarkup(<PluginFooter onPanelChange={() => {}} />));
  it("gives each existing action a distinct label and preserves its destination", () => {
    expect($('nav[aria-label="Catalog actions"] button').map((_, el) => $(el).text()).get()).toEqual(["Submit a logo", "Changelog", "Trademark policy"]);
    expect($('a[href="https://awalogo.com"]').length).toBe(1);
    expect($('a[href="https://github.com/adeyemimayokun/awalogo"]').length).toBe(1);
    expect($('a[href$="CONTRIBUTING.md"]').text()).toBe("Contribution guide");
    expect($('button[aria-label="Back to top"]').length).toBe(1);
  });
  it("separates the legal note from links instead of cramming it into one row", () => {
    expect($(".plugin-footer-note").text()).toContain("MIT-licensed tooling");
    expect($(".plugin-footer-links .plugin-footer-note").length).toBe(0);
    expect($(".footer-bottom, .footer-copyright, .frame-register").length).toBe(0);
  });
});
