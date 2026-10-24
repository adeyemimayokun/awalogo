import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("Figma bulk controller", () => {
  it("inserts a mixed editable group without replacing the existing selection", async () => {
    const created: any[] = [];
    function node(width: number, height: number) {
      const value = { type: "RECTANGLE", width, height, x: 0, y: 0, removed: false,
        resize(w: number, h: number) { this.width = w; this.height = h; },
        rescale(scale: number) { this.width *= scale; this.height *= scale; },
        setPluginData: vi.fn(), remove() { this.removed = true; } };
      created.push(value);
      return value;
    }
    const existing = { remove: vi.fn() };
    const api: any = { showUI: vi.fn(), ui: { postMessage: vi.fn() },
      currentPage: { selection: [existing], appendChild: vi.fn() },
      viewport: { center: { x: 500, y: 500 }, scrollAndZoomIntoView: vi.fn() },
      createNodeFromSvg: vi.fn(() => ({ ...node(400, 100), type: "FRAME" })),
      createRectangle: vi.fn(() => node(100, 100)), createImage: vi.fn(() => ({ hash: "image" })),
      group: vi.fn(() => ({ width: 456, height: 140, x: 0, y: 0 })), notify: vi.fn() };
    vi.stubGlobal("figma", api); vi.stubGlobal("__html__", "");
    await import("./main");
    await api.ui.onmessage({ type: "insert-pack", requestId: "batch", items: [
      { type: "insert-logo", name: "Vector", svg: "<svg />", width: 200, height: 140 },
      { type: "insert-image", name: "Flag", mimeType: "image/png", bytes: [1], width: 400, height: 300 }
    ] });
    expect(api.group).toHaveBeenCalledOnce();
    expect(api.currentPage.selection[0].x).toBe(272);
    expect(existing.remove).not.toHaveBeenCalled();
    expect(api.ui.postMessage).toHaveBeenCalledWith({ type: "pack-inserted", requestId: "batch", count: 2 });
    expect(api.viewport.scrollAndZoomIntoView).toHaveBeenCalledOnce();
    api.createImage.mockImplementation(() => { throw new Error("Bad image"); });
    await api.ui.onmessage({ type: "insert-pack", requestId: "failure", items: [
      { type: "insert-image", name: "Broken", mimeType: "image/png", bytes: [1], width: 400, height: 300 }
    ] });
    expect(created.at(-1)?.removed).toBe(true);
    expect(api.ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "request-error", requestId: "failure" }));
  });
});
