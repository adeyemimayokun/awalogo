import { describe, expect, it } from "vitest";
import { load } from "cheerio";
import { discoverBrandArtwork } from "../../scripts/lib/brand-artwork.mjs";

const discover = (html, name = "Example") => discoverBrandArtwork(load(html), "https://example.com/about", name);
describe("official brand artwork discovery", () => {
  it("finds lazy-loaded company logos instead of placeholder SVGs", () => {
    const results = discover('<header><img class="site-logo" src="data:image/svg+xml,placeholder" data-lazy-src="/company.png"></header>');
    expect(results[0].url).toBe("https://example.com/company.png");
  });
  it("ranks the corporate header logo ahead of product and partner marks", () => {
    const results = discover('<img alt="Partner logo" src="/partner-logo.png"><header><div data-widget_type="theme-site-logo.default"><img src="/corporate.svg"></div></header>');
    expect(results[0].url).toBe("https://example.com/corporate.svg");
  });
  it("stages embedded named brand marks, not unrelated interface icons", () => {
    const results = discover('<div class="airtelIcn"><svg viewBox="0 0 54 57"><path fill="#ec1a23" d="M0 0h54v57z"/></svg></div><svg class="search" viewBox="0 0 24 24"></svg>', "Airtel Nigeria");
    expect(results).toHaveLength(1);
    expect(results[0].bytes.toString()).toContain('fill="#ec1a23"');
    expect(results[0].url).toContain("#inline-logo-");
  });
  it("finds official press-kit downloads and srcset-only logos", () => {
    const results = discover('<a href="/press/logos/company.png">Download</a><img alt="Example logo" srcset="/example.webp 1x, /example-2.webp 2x">');
    expect(results.map((item) => item.url)).toEqual(["https://example.com/press/logos/company.png", "https://example.com/example.webp"]);
  });
  it("does not return unsafe network URLs", () => {
    expect(discover('<img alt="Example logo" src="javascript:alert(1)"><a href="http://example.com/logo.svg">Logo</a>')).toEqual([]);
  });
});
