import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import * as icons from "./icons";

describe("free Boxicons adapter", () => {
  it("renders every mapped action with real artwork and stable dimensions", () => {
    for (const Icon of Object.values(icons)) {
      const $ = load(renderToStaticMarkup(<Icon size={18} />));
      expect($("svg.boxicon")).toHaveLength(1);
      expect($("svg").attr("width")).toBe("18");
      expect($("svg").attr("height")).toBe("18");
      expect($("svg").attr("fill")).toBe("currentColor");
      expect($("svg").attr("aria-hidden")).toBe("true");
      expect($("svg").attr("focusable")).toBe("false");
      expect($("path[d]").length).toBeGreaterThan(0);
      expect($("svg").hasClass("lucide")).toBe(false);
    }
  });
  it("inherits foreground colors for light, dark and primary-button contexts", () => {
    for (const color of ["#252525", "#ededeb", "#ffffff", "#202020"]) {
      const $ = load(renderToStaticMarkup(<span style={{ color }}><icons.Search size={20} className="custom" /></span>));
      expect($("svg").attr("fill")).toBe("currentColor");
      expect($("svg").hasClass("custom")).toBe(true);
      expect($("svg path[fill]").length).toBe(0);
    }
  });
});
