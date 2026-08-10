import { describe, expect, it } from "vitest";
import { isUiToPluginMessage } from "./messages";

describe("plugin messages", () => {
  it("accepts supported controller messages", () => {
    expect(isUiToPluginMessage({ type: "close" })).toBe(true);
    expect(isUiToPluginMessage({ type: "insert-logo", name: "OPay", svg: "<svg />", width: 512, height: 180 })).toBe(true);
    expect(isUiToPluginMessage({ type: "insert-image", name: "OPay", mimeType: "image/png", bytes: [137, 80, 78, 71], width: 512, height: 180 })).toBe(true);
    expect(isUiToPluginMessage({ type: "catalog-load", requestId: "catalog-1" })).toBe(true);
    expect(isUiToPluginMessage({ type: "asset-load", requestId: "asset-1", url: "https://www.awalogo.com/catalog/v1/assets/example.svg", checksum: "a".repeat(64) })).toBe(true);
  });

  it("rejects malformed messages", () => {
    expect(isUiToPluginMessage(null)).toBe(false);
    expect(isUiToPluginMessage({ type: "insert-logo", name: "OPay" })).toBe(false);
    expect(isUiToPluginMessage({ type: "insert-image", name: "OPay", mimeType: "image/png", bytes: [300], width: 512, height: 180 })).toBe(false);
    expect(isUiToPluginMessage({ type: "insert-logo", name: "OPay", svg: "<svg />", width: 0, height: 180 })).toBe(false);
    expect(isUiToPluginMessage({ type: "unknown" })).toBe(false);
  });
});
