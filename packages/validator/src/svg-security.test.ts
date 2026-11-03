import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateSvgSecurity } from "../svg-security.mjs";

const svg = (body = "", attrs = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${attrs}>${body}</svg>`;
const root = fileURLToPath(new URL("../../../", import.meta.url));

describe("shared SVG security policy", () => {
  it("preserves safe bytes including parsed CSS and fragment paint servers", () => {
    const input = Buffer.from(svg('<style>.a,.b{fill:#fff;stroke-width:2}</style><defs><path id="a" d="M0 0"/></defs><use href="#a"/><path style="clip-path:url(\'#a\');fill:rgb(1,2,3)"/>'));
    expect(validateSvgSecurity(input)).toBe(input);
    expect(validateSvgSecurity(svg("", 'width="24" height="24"'))).toContain("viewBox");
    expect(validateSvgSecurity('<?xml version="1.0" encoding="UTF-8"?>' + svg())).toContain("UTF-8");
  });

  it.each([
    '<s:script xmlns:s="http://www.w3.org/2000/svg">alert(1)</s:script>',
    '<s:path xmlns:s="http://www.w3.org/2000/svg"/>',
    '<script/>', '<foreignObject/>', '<iframe/>', '<a href="#a"/>',
    '<animate attributeName="href" to="javascript:alert(1)"/>', '<set/>', '<animateTransform/>',
    '<g xmlns="http://www.w3.org/1999/xhtml"/>', '<g xmlns=""/>',
    '<g xmlns:evil="https://evil.example"/>', '<path evil:fill="red"/>',
    '<path onclick="alert(1)"/>', '<path onload="alert(1)"/>',
    '<use href="javascript:alert(1)"/>', '<use href="&#106;avascript:alert(1)"/>',
    '<use href="https://evil.example/a.svg#x"/>', '<use href="//evil.example/a"/>',
    '<use href="/a.svg#x"/>', '<use href="a.svg#x"/>', '<use href="data:image/svg+xml;base64,PHN2Zy8+"/>',
    '<use href=" #x"/>', '<use href="%23x"/>',
    '<path fill="url(&#104;ttps://evil.example/x)"/>', '<path fill="URL(//evil.example/x)"/>',
    '<style>@import "https://evil.example/a.css";</style>',
    '<style>@font-face{font-family:x;src:url(https://evil.example/f)}</style>',
    '<style>.a{fill:u\\72l(https://evil.example)}</style>',
    '<style>.a{--x:url(https://evil.example);fill:var(--x)}</style>',
    '<style>.a{fill:expression(alert(1))}</style>', '<style>.a{background:red}</style>',
    '<style>.a{fill:red!important}</style>', '<style>.a{fill:red; broken}</style>',
    '<path style="fill:url(data:image/svg+xml;base64,PHN2Zy8+)"/>',
    '<path style="fill:var(--untrusted)"/>',
    '<image href="https://evil.example/a.png"/>',
    '<image href="data:text/html;base64,PHN2Zy8+"/>',
    '<image href="data:image/png;base64,PHN2Zy8+"/>',
  ])("rejects active/namespaced/external content: %s", (body) => {
    expect(() => validateSvgSecurity(svg(body))).toThrow(/unsafe/i);
  });

  it.each([
    '<!DOCTYPE svg>' + svg(),
    '<!DOCTYPE svg SYSTEM "https://evil.example/a.dtd">' + svg(),
    '<!DOCTYPE svg [<!ENTITY x "test">]>' + svg("&x;"),
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + svg("&x;"),
    '<?xml-stylesheet href="https://evil.example/a.css"?>' + svg(),
    '<?xml version="1.0"?><?xml version="1.0"?>' + svg(),
    '<?xml version="1.0" encoding="UTF-16"?>' + svg(),
    '<?xml VERSION="1.0"?>' + svg(),
    '<?xml version="1.0\'?>' + svg(),
    '<svg viewBox="0 0 1 1"><g></svg>', '<svg viewBox="0 0 1 1">',
    svg() + svg(), svg() + "trailing", "text" + svg(),
    '<svg viewBox="0 0 1 1" width="1" width="2"/>',
    '<svg viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg" xmlns="http://evil.example"/>',
    '<svg viewBox="0 0 1 1" width=1/>', '<svg viewBox="0 0 1 1" width="1\'/>',
    svg("&unknown;"), svg("&#0;"), svg("&#xD800;"), svg("&#xFFFE;"), svg("<!-- invalid -- comment -->"),
    '<s:svg xmlns:s="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
    '<svg xmlns="http://evil.example" viewBox="0 0 1 1"/>',
  ])("rejects declarations and malformed XML: %s", (text) => {
    expect(() => validateSvgSecurity(text)).toThrow(/unsafe/i);
  });

  it("rejects invalid UTF-8 rather than validating replacement characters", () => {
    expect(() => validateSvgSecurity(Buffer.concat([Buffer.from(svg()), Buffer.from([0xff])]))).toThrow(/UTF-8/);
  });

  it("validates the actual tracked corpus without rewriting files", () => {
    const paths = execFileSync("git", ["ls-files", "*.svg"], { cwd: root, encoding: "utf8" }).trim().split("\n");
    // Unpublished originals are intentionally not grandfathered through the policy.
    const rejected = new Set([
      "packages/brands/assets/7a7edc81ee9c8a1172f3fb5fe0a0e20c257b1638b04b4a4ffb7f0d30bf38f44c.svg",
      "packages/logos/sourcing/official-candidates/securities-and-exchange-commission-nigeria/sec.svg",
      "packages/logos/sourcing/variation-candidates/noor-takaful/01-alternate.svg",
      "packages/logos/sourcing/web-candidates/youverify/02.svg",
    ]);
    expect(paths.length).toBeGreaterThan(1000);
    for (const path of paths) {
      const bytes = readFileSync(resolve(root, path));
      if (rejected.has(path)) expect(() => validateSvgSecurity(bytes), path).toThrow();
      else expect(validateSvgSecurity(bytes), path).toBe(bytes);
    }
    expect(paths.filter((path) => path.startsWith("apps/web/public/"))).not.toHaveLength(0);
  }, 30_000);
});
