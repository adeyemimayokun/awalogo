import { describe, expect, it } from "vitest";
import { shouldStartTour } from "./V2Tour";

describe("V2 first-visit tour launch gate", () => {
  it("supports automatic first-visit previews only on a local development server", () => {
    expect(shouldStartTour("false", "http://127.0.0.1:5180/v2", false, true)).toBe(true);
    expect(shouldStartTour(undefined, "http://localhost:5180/v2/flags", false, true)).toBe(true);
    expect(shouldStartTour("false", "http://127.0.0.1:5180/v2", true, true)).toBe(false);
    expect(shouldStartTour("false", "https://preview.vercel.app/v2", false, true)).toBe(false);
  });
  it("waits for an explicit live release and an unseen visit", () => {
    expect(shouldStartTour("true", "https://awalogo.com/v2", false)).toBe(true);
    expect(shouldStartTour("true", "https://www.awalogo.com/v2/flags", false)).toBe(true);
    expect(shouldStartTour(undefined, "https://awalogo.com/v2", false)).toBe(false);
    expect(shouldStartTour("false", "https://awalogo.com/v2", false)).toBe(false);
    expect(shouldStartTour("true", "https://awalogo.com/v2", true)).toBe(false);
  });
  it("never auto-starts on staging, local, V1, inner pages or shared asset links", () => {
    for (const url of ["http://localhost:5180/v2", "https://preview.vercel.app/v2", "https://awalogo.com/", "https://awalogo.com/v2/about", "https://awalogo.com/v2/requests", "https://awalogo.com/v2?brand=airtel-nigeria"]) {
      expect(shouldStartTour("true", url, false)).toBe(false);
    }
  });
});
