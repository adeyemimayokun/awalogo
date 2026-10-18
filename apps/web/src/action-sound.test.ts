import { afterEach, describe, expect, it, vi } from "vitest";
import { initialSound, playActionSound } from "./action-sound";

afterEach(() => vi.unstubAllGlobals());
describe("optional action audio", () => {
  it("defaults on without creating audio and respects a saved mute", () => {
    const Audio = vi.fn(); vi.stubGlobal("AudioContext", Audio);
    vi.stubGlobal("localStorage", { getItem:() => null });
    expect(initialSound()).toBe(true);
    expect(Audio).not.toHaveBeenCalled();
    vi.stubGlobal("localStorage", { getItem:() => "off" });
    expect(initialSound()).toBe(false);
  });
  it("does not interrupt commands when audio or storage is unavailable", () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("localStorage", { getItem:() => { throw Error("unavailable"); } });
    expect(initialSound()).toBe(true);
    expect(() => playActionSound("pack")).not.toThrow();
  });
});
