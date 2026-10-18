import { describe, expect, it } from "vitest";
import { sanitizeAnalyticsEvent, shouldTrackAnalytics } from "./site-analytics";

const enabled = { productionBuild:true, enabled:"true", url:"https://www.awalogo.com/v2" };
describe("production visit analytics", () => {
  it("tracks only enabled public production pages", () => {
    expect(shouldTrackAnalytics(enabled)).toBe(true);
    for (const url of ["https://awalogo.com/", "https://www.awalogo.com/docs", "https://www.awalogo.com/v2/flags"]) expect(shouldTrackAnalytics({ ...enabled, url })).toBe(true);
    for (const option of [{ productionBuild:false }, { enabled:"false" }, { enabled:undefined }, { privacyOptOut:true }]) expect(shouldTrackAnalytics({ ...enabled, ...option })).toBe(false);
  });
  it("never loads on preview, localhost or unrelated hosts even with the flag enabled", () => {
    for (const url of ["http://127.0.0.1:5181/v2", "https://nigerian-bank-logos-git-staging-ship-with-ai.vercel.app/v2", "https://www.awalogo.com.evil.example/", "http://www.awalogo.com/"]) expect(shouldTrackAnalytics({ ...enabled, url })).toBe(false);
  });
  it("drops private pages at mount and after client-side navigation", () => {
    for (const path of ["/admin", "/admin/requests", "/auth/callback", "/api/auth/callback", "/requests", "/v2/requests", "/v2/requests/?token=private", "/v2/%72equests"]) {
      const url = `https://www.awalogo.com${path}`;
      expect(shouldTrackAnalytics({ ...enabled, url })).toBe(false);
      expect(sanitizeAnalyticsEvent({ type:"pageview", url })).toBeNull();
    }
  });
  it("removes queries and fragments without mutating the incoming pageview", () => {
    const event = { type:"pageview" as const, url:"https://www.awalogo.com/v2?brand=t2-mobile&token=private#email=user@example.com" };
    expect(sanitizeAnalyticsEvent(event)).toEqual({ type:"pageview", url:"https://www.awalogo.com/v2" });
    expect(event.url).toContain("token=private");
  });
  it("fails closed for malformed URLs, preview events and custom events", () => {
    for (const url of ["invalid", "https://www.awalogo.com/%xx", "https://preview.vercel.app/v2"]) expect(sanitizeAnalyticsEvent({ type:"pageview", url })).toBeNull();
    expect(sanitizeAnalyticsEvent({ type:"event", url:enabled.url })).toBeNull();
  });
});
