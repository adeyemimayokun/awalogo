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
    expect(results.map((item) => item.url)).toEqual(["https://example.com/press/logos/company.png", "https://example.com/example-2.webp"]);
  });
  it("does not return unsafe network URLs", () => {
    expect(discover('<img alt="Example logo" src="javascript:alert(1)"><a href="http://example.com/logo.svg">Logo</a>')).toEqual([]);
  });
  it("finds embedded raster home-link logos that previously fell back to footer marks", () => {
    const payload = Buffer.from("reviewed raster candidate").toString("base64");
    const results = discover(`<nav><a href="/"><img src="data:image/png;base64,${payload}"></a></nav><footer><img alt="Example footer logo mark" src="/footer-mark.png"></footer>`);
    expect(results[0].url).toContain("#embedded-header-logo-");
    expect(results[0].bytes.toString()).toBe("reviewed raster candidate");
  });
  it("excludes data URI placeholders outside branded headers and data SVGs", () => {
    expect(discover('<img alt="Example logo" src="data:image/png;base64,YQ=="><nav><a href="/"><img src="data:image/svg+xml;base64,YQ=="></a></nav>')).toEqual([]);
  });
  it("finds named headers with hashed URLs and prefers higher-resolution srcsets", () => {
    const results = discover('<header><img alt="Example" src="/small.png" srcset="/small.png 120w, /large.png 600w"></header><footer><img alt="Example logo" src="/footer-logo.png"></footer>');
    expect(results[0].url).toBe("https://example.com/large.png");
  });
});
