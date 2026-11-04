import { describe, expect, it } from "vitest";
import { shouldStartTour } from "./V2Tour";

describe("V2 first-visit tour launch gate", () => {
  it("supports automatic first-visit previews only on a local development server", () => {
    expect(shouldStartTour("false", "http://127.0.0.1:5180/", false, true)).toBe(true);
    expect(shouldStartTour(undefined, "http://localhost:5180/flags", false, true)).toBe(true);
    expect(shouldStartTour("false", "http://127.0.0.1:5180/", true, true)).toBe(false);
    expect(shouldStartTour("false", "https://preview.vercel.app/", false, true)).toBe(false);
  });
  it("waits for an explicit live release and an unseen visit", () => {
    expect(shouldStartTour("true", "https://awalogo.com/", false)).toBe(true);
    expect(shouldStartTour("true", "https://www.awalogo.com/flags", false)).toBe(true);
    expect(shouldStartTour(undefined, "https://awalogo.com/", false)).toBe(false);
    expect(shouldStartTour("false", "https://awalogo.com/", false)).toBe(false);
    expect(shouldStartTour("true", "https://awalogo.com/", true)).toBe(false);
  });
  it("never auto-starts on staging, local, V1, inner pages or shared asset links", () => {
    for (const url of ["http://localhost:5180/", "https://preview.vercel.app/", "https://awalogo.com/v1", "https://awalogo.com/about", "https://awalogo.com/requests", "https://awalogo.com/?brand=airtel-nigeria"]) {
      expect(shouldStartTour("true", url, false)).toBe(false);
    }
  });
});
