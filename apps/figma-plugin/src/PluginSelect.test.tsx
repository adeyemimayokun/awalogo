import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { PluginSelect } from "./PluginSelect";

describe("plugin select", () => {
  it("keeps native selection semantics and uses one decorative inset chevron", () => {
    const $ = load(renderToStaticMarkup(<PluginSelect aria-label="Sort resources" value="newest" onChange={() => {}}><option value="name">Name A-Z</option><option value="newest">Recently added</option></PluginSelect>));
    expect($("select").length).toBe(1);
    expect($('select[aria-label="Sort resources"]').length).toBe(1);
    expect($("option[selected]").val()).toBe("newest");
    expect($('.plugin-select > svg[aria-hidden="true"]').length).toBe(1);
  });
  it("preserves form names, disabled and validation attributes", () => {
    const $ = load(renderToStaticMarkup(<PluginSelect name="category" disabled aria-invalid="true"><option>Other</option></PluginSelect>));
    expect($('select[name="category"][disabled][aria-invalid="true"]').length).toBe(1);
  });
});
