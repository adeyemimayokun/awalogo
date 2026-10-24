import { afterEach, describe, expect, it, vi } from "vitest";
import { requestFromFigma } from "./figma-bridge";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Figma bridge response routing", () => {
  it("ignores unrelated response types and foreign message sources without dropping the pending request", async () => {
    vi.useFakeTimers();
    const listeners = new Set<(event: unknown) => void>();
    const parent = { postMessage: vi.fn() };
    vi.stubGlobal("window", { parent, setTimeout, clearTimeout, addEventListener: (_: string, listener: (event: unknown) => void) => listeners.add(listener), removeEventListener: (_: string, listener: (event: unknown) => void) => listeners.delete(listener) });
    const request = requestFromFigma({ type: "asset-load", url: "asset", checksum: "hash" }, "asset-result");
    const requestId = parent.postMessage.mock.calls[0][0].pluginMessage.requestId;
    const emit = (source: unknown, message: unknown) => listeners.forEach((listener) => listener({ source, data: { pluginMessage: message } }));
    emit({}, { type: "request-error", requestId, message: "foreign" });
    emit(parent, { type: "catalog-result", requestId });
    expect(listeners.size).toBe(1);
    emit(parent, { type: "asset-result", requestId, bytes: [1], checksum: "hash", source: "cache" });
    await expect(request).resolves.toMatchObject({ type: "asset-result", bytes: [1] });
    expect(listeners.size).toBe(0);
  });
});
