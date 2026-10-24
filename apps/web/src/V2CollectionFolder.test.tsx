import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import V2CollectionFolder from "./V2CollectionFolder";

describe("collection folder preview", () => {
  it("shows the three most recent assets without exposing decorative images to screen readers", () => {
    const $ = load(renderToStaticMarkup(<V2CollectionFolder previews={[{src:"/one.svg"},{src:"/two.svg"},{src:"/three.svg",dark:true},{src:"/four.svg"}]} />));
    expect($("img").map((_, node) => $(node).attr("src")).get()).toEqual(["/two.svg", "/three.svg", "/four.svg"]);
    expect($(".v2-collection-folder").attr("aria-hidden")).toBe("true");
    expect($(".v2-folder-paper.is-dark img").attr("src")).toBe("/three.svg");
    expect($("img[draggable=false]").length).toBe(3);
  });
  it("keeps an empty collection visually recognizable", () => {
    const $ = load(renderToStaticMarkup(<V2CollectionFolder />));
    expect($(".v2-folder-paper").length).toBe(3);
    expect($("img").length).toBe(0);
  });
});
