import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./v2-style.css", import.meta.url), "utf8");
const v2 = readFileSync(new URL("../../web/src/v2.css", import.meta.url), "utf8");
describe("plugin V2 design contract", () => {
  it("matches V2's light and dark neutral tokens", () => {
    for (const [token, value] of [["ink", "#252525"], ["muted", "#70706e"], ["line", "#e5e5e2"], ["surface", "#fff"], ["ink", "#ededeb"], ["line", "#3b3b3b"], ["surface", "#1c1c1c"]]) {
      expect(v2).toContain(`--${token}:${value}`);
      expect(css).toContain(`--plugin-${token}: ${value}`);
    }
    expect(css).toContain("--plugin-control-radius: 12px");
    expect(css).toContain("--plugin-focus: #92928e");
  });
  it("covers all plugin views without modifying V1 styles or insertion logic", () => {
    for (const name of ["logo-grid", "detail-sheet", "project-sheet", "request-field", "plugin-pack-sheet", "plugin-report", "changelog-entry", "empty-state", "site-footer"]) expect(css).toContain(`.${name}`);
    expect(css).toContain(".detail-backdrop { justify-content: center; align-items: center;");
    expect(css).toContain(".detail-sheet { height: auto; }");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("pointer: coarse");
    expect(css).not.toMatch(/#(?:c9e45d|d5ec79|8ca42d)/i);
  });
  it("keeps compound input focus on its rounded container only", () => {
    expect(css).toContain(":is(.category-search, .dimension-field) input:focus-visible { outline: none; outline-offset: 0; box-shadow: none; }");
    expect(css).toContain(":is(.dimension-field, .category-search):focus-within { outline: none; border-color: var(--plugin-focus); box-shadow: inset 0 0 0 1px var(--plugin-focus); }");
    expect(css).toContain(".category-search { min-width: 0; margin: 10px 12px; border: 1px solid var(--plugin-line); }");
  });
  it("groups the theme switch and options under one border without removing either action", () => {
    expect(css).toContain(".theme-menu { display: inline-flex; gap: 0;");
    expect(css).toContain('.theme-menu > .theme-menu-trigger[aria-haspopup="menu"]');
    expect(css).toContain("border-radius: 0 11px 11px 0");
    expect(css).toContain(".theme-menu:focus-within { border-color: var(--plugin-focus); }");
  });
  it("reserves consistent arrow space for every native select", () => {
    expect(css).toContain("padding: 7px 40px 7px 12px");
    expect(css).toContain("appearance: none; -webkit-appearance: none");
    expect(css).toContain("right: 12px; top: 50%");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain(".plugin-select select:is(:focus, :focus-visible) { outline: none;");
  });
});
