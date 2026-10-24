import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import V2FloatingBag from "./V2FloatingBag";
import { assetFlight, bagPopoverLayout, BAG_SIZE, constrainBag, restoreBag } from "./floating-bag";

describe("floating download bag", () => {
  it("anchors the collection above or below the icon without leaving the screen", () => {
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      for (const position of [{ x: 16, y: 16 }, { x: width - BAG_SIZE - 16, y: height - BAG_SIZE - 16 }, { x: width / 2, y: height / 2 }]) {
        const popup = bagPopoverLayout(position, width, height);
        expect(popup.left).toBeGreaterThanOrEqual(16);
        expect(popup.left + popup.width).toBeLessThanOrEqual(width - 16);
        expect(popup.maxHeight).toBeLessThanOrEqual(420);
        if ("top" in popup) expect(popup.top + popup.maxHeight).toBeLessThanOrEqual(height - 16);
        if ("bottom" in popup) expect(height - popup.bottom - popup.maxHeight).toBeGreaterThanOrEqual(16);
      }
    }
  });
  it("keeps dragged and restored positions within the viewport", () => {
    expect(constrainBag({ x: -500, y: 5000 }, 390, 844)).toEqual({ x: 16, y: 844 - BAG_SIZE - 16 });
    expect(restoreBag({ x: .5, y: .5 }, 1000, 800)).toEqual({ x: 500, y: 400 });
    expect(restoreBag({ x: Infinity, y: 10 }, 390, 844)).toEqual(restoreBag(null, 390, 844));
    expect(restoreBag("broken", 390, 844)).toEqual(restoreBag(null, 390, 844));
  });
  it("gives the asset a raised arc and shrinks it into the bag", () => {
    const frames = assetFlight({ x: 100, y: 100 }, { x: 400, y: 400 });
    expect(frames).toHaveLength(25);
    expect(frames[0].transform).toContain("translate3d(72px,72px,0)");
    expect(frames.at(-1)?.transform).toContain("translate3d(372px,372px,0)");
    expect(frames.at(-1)?.opacity).toBe(0);
    expect(frames.every((frame) => !frame.transform.includes("NaN"))).toBe(true);
  });
  it("exposes a named button, count and keyboard movement help", () => {
    const $ = load(renderToStaticMarkup(<V2FloatingBag count={3} addition={null} onOpen={() => {}} panelOpen={false} />));
    expect($("button").attr("aria-label")).toBe("Download bag, 3 assets");
    expect($(".v2-floating-bag-count").text()).toBe("3");
    expect($("#v2-bag-move-help").text()).toContain("arrow keys");
    expect($("button").attr("tabindex")).toBe("0");
  });
  it("does not compete with the active dialog for keyboard focus", () => {
    const $ = load(renderToStaticMarkup(<V2FloatingBag count={0} addition={null} onOpen={() => {}} panelOpen />));
    expect($("button").attr("tabindex")).toBe("-1");
    expect($("button").attr("aria-hidden")).toBe("true");
  });
});
