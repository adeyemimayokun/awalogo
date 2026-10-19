import { describe, expect, it } from "vitest";
import { packLayout } from "./pack-layout";
import { isUiToPluginMessage } from "./messages";

describe("bulk insertion", () => {
  it("fits mixed proportions in non-overlapping grid cells", () => {
    const sizes = Array.from({ length: 50 }, (_, i) => ({ width: i % 2 ? 20 : 900, height: i % 2 ? 900 : 20 }));
    const layout = packLayout(sizes);
    layout.forEach((cell, i) => {
      expect(cell.width).toBeLessThanOrEqual(200);
      expect(cell.height).toBeLessThanOrEqual(140);
      expect(cell.width / cell.height).toBeCloseTo(sizes[i].width / sizes[i].height);
      layout.slice(i + 1).forEach((other) => {
        expect(cell.x + cell.width <= other.x || other.x + other.width <= cell.x || cell.y + cell.height <= other.y || other.y + other.height <= cell.y).toBe(true);
      });
    });
    expect(packLayout([])).toEqual([]);
  });
  it("validates every item and rejects empty, oversized and nested batches", () => {
    const item = { type: "insert-logo", name: "Logo", svg: "<svg />", width: 200, height: 100 };
    const batch = { type: "insert-pack", requestId: "test", items: [item] };
    expect(isUiToPluginMessage(batch)).toBe(true);
    expect(isUiToPluginMessage({ ...batch, items: [] })).toBe(false);
    expect(isUiToPluginMessage({ ...batch, items: Array(51).fill(item) })).toBe(false);
    expect(isUiToPluginMessage({ ...batch, items: [batch] })).toBe(false);
    expect(isUiToPluginMessage({ ...batch, items: [{ ...item, svg: "invalid" }] })).toBe(false);
  });
});
