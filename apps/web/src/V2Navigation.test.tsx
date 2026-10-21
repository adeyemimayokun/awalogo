import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import V2Navigation from "./V2Navigation";

const noop = () => {};
function navigation(showCategories = true, isRequest = false, theme: "light" | "dark" = "light") {
  return load(renderToStaticMarkup(<V2Navigation isRequest={isRequest} showCategories={showCategories} category={[]} categories={[]} total={277} theme={theme} onTheme={noop} onCategory={noop} onRequest={noop} onLibrary={noop} onSearch={noop} onFlags={noop} onInfo={noop} />));
}
describe("V2 top navigation", () => {
  it("shows the destination theme icon rather than the current theme", () => {
    const light = navigation();
    expect(light('button[aria-label="Switch to dark mode"] .boxicon-moon')).toHaveLength(1);
    const dark = navigation(true, false, "dark");
    expect(dark('button[aria-label="Switch to light mode"] .boxicon-sun')).toHaveLength(1);
  });
  it("keeps the brand, primary sections and utility controls accessible", () => {
    const $ = navigation();
    expect($("nav.v2-topnav").length).toBe(1);
    expect($(".v2-topnav-brand").text()).toContain("awalogo");
    expect($(".v2-topnav-links").text()).toContain("Browse");
    expect($(".v2-topnav-links").text()).toContain("Flags");
    expect($('a[href^="https://www.figma.com/community/plugin/"]').length).toBe(1);
    expect($('button[aria-label="Download bag, 3 assets"]').length).toBe(0);
    expect($('button[aria-label="Request a brand"]').length).toBe(1);
    expect($('button[aria-label="Search brands"]').length).toBe(1);
  });
  it("marks the selected resource rather than always highlighting Browse", () => {
    const $ = navigation(false);
    expect($('[aria-current="page"]').text()).toBe("Flags");
    expect($('a[aria-label="Brand library"]').attr("aria-current")).toBeUndefined();
  });
  it("keeps request pages distinct from the selected resource", () => {
    const $ = navigation(true, true);
    expect($('[aria-current="page"]').length).toBe(0);
    expect($('button[aria-label="Request a brand"]').hasClass("active")).toBe(true);
  });
});
