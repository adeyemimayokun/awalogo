import { describe, expect, it } from "vitest";
import { buildLogoReportUrl, pluginShortcut } from "./browse-controls";

const key = { key: "/", altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, isComposing: false, repeat: false };
describe("plugin browsing controls", () => {
  it("routes search and request without interfering with editing or modifiers", () => {
    expect(pluginShortcut(key, false)).toBe("search");
    expect(pluginShortcut({ ...key, key: "r", altKey: true }, false)).toBe("request");
    expect(pluginShortcut(key, true)).toBeUndefined();
    for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "isComposing", "repeat"] as const) {
      expect(pluginShortcut({ ...key, [modifier]: true }, false)).toBeUndefined();
    }
    expect(pluginShortcut({ ...key, key: "Delete" }, false)).toBeUndefined();
  });
  it("prepares a report without submitting it or losing the exact asset version", () => {
    const url = new URL(buildLogoReportUrl("Bank & Co", "bank-previous", "https://example.com"));
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/adeyemimayokun/awalogo/issues/new");
    expect(url.searchParams.get("title")).toBe("Logo report: Bank & Co");
    expect(url.searchParams.get("body")).toContain("bank-previous");
    expect(url.searchParams.get("body")).toContain("https://example.com");
  });
});
