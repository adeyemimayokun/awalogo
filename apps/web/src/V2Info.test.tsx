import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import V2Info from "./V2Info";
import { previewUpdates, previewChangelog } from "./v2-release-notes";
import legacyUpdates from "../../../packages/catalog-ui/src/site-updates.json";
import legacyChangelog from "../../../packages/catalog-ui/src/changelog.json";
import { logos } from "./v2-brand-data";
import { flags } from "./flags-data";
import { messages } from "./v2-translations";

const noop = () => {};
describe("V2 information and preview documentation", () => {
  it("describes the expanded preview rather than a finance-only launched product", () => {
    const $ = load(renderToStaticMarkup(<V2Info page="about" onBrand={noop} onNewest={noop} onRequest={noop} />));
    expect($.text()).toContain("Nigerian and African company logos");
    expect($.text()).toContain("Coming soon");
    expect($.text()).toContain("current Figma plugin keep their existing catalogs");
  });
  it("documents pack/drop, flag workflows and preferences with a working docs anchor", () => {
    const $ = load(renderToStaticMarkup(<V2Info page="help" onBrand={noop} onNewest={noop} onRequest={noop} />));
    for (const text of ["20 items", "eight-second undo", "Flags support", "More options"]) expect($.text()).toContain(text);
    expect($('a[href="/docs#v2"]')).toHaveLength(1);
    expect($("button.v2-primary")).toHaveLength(1);
  });
  it("keeps preview notes out of V1 editorial feeds and counts aligned with data", () => {
    expect(legacyUpdates.some((entry) => entry.id === previewUpdates[0].id)).toBe(false);
    expect(legacyChangelog.some((entry) => entry.version === previewChangelog[0].version)).toBe(false);
    expect(previewUpdates[0].summary).toContain(`${logos.length} company entries`);
    expect(previewUpdates[0].summary).toContain(`${flags.length} flags`);
    for (const page of ["updates", "changelog"] as const) {
      const html = renderToStaticMarkup(<V2Info page={page} onBrand={noop} onNewest={noop} onRequest={noop} />);
      expect(html).toContain("2026-10-18");
      expect(html).toContain("Coming soon");
    }
  });
  it("includes all new information-panel copy in the translation dictionary", () => {
    for (const page of ["about", "usage", "help", "contribute"] as const) {
      const $ = load(renderToStaticMarkup(<V2Info page={page} onBrand={noop} onNewest={noop} onRequest={noop} />));
      $("p:not(.v2-eyebrow)").each((_, el) => { expect(messages[$(el).text()], $(el).text()).toHaveLength(4); });
    }
  });
});
