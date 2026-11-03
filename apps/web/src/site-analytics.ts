import type { BeforeSendEvent } from "@vercel/analytics";
import type { BeforeSendMiddleware } from "@vercel/speed-insights";

const productionOrigins = new Set(["https://awalogo.com", "https://www.awalogo.com"]);

function publicAnalyticsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const path = new URL(decodeURIComponent(url.pathname).replace(/\/+/g, "/"), url.origin).pathname;
    if (!productionOrigins.has(url.origin) || /^\/(admin|api|auth|requests)(\/|$)/i.test(path) || /^\/v2\/requests(\/|$)/i.test(path)) return null;
    url.search = "";
    url.hash = "";
    return url;
  } catch { return null; }
}

export function shouldTrackAnalytics({ productionBuild, enabled, url, privacyOptOut = false }: { productionBuild:boolean; enabled:string | undefined; url:string; privacyOptOut?:boolean }): boolean {
  return productionBuild && enabled === "true" && !privacyOptOut && publicAnalyticsUrl(url) !== null;
}

export function analyticsPrivacyOptOut(): boolean {
  return typeof navigator !== "undefined" && (navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true);
}

function maySendTelemetry(): boolean {
  return !analyticsPrivacyOptOut() && (typeof window === "undefined" || publicAnalyticsUrl(window.location.href) !== null);
}

export function sanitizeAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview" || !maySendTelemetry()) return null;
  const url = publicAnalyticsUrl(event.url);
  return url ? { type:"pageview", url:url.href } : null;
}

export const sanitizeSpeedInsightsEvent: BeforeSendMiddleware = (event) => {
  if (!maySendTelemetry()) return null;
  const url = publicAnalyticsUrl(event.url);
  return url ? { type: "vital", url: url.href, route: url.pathname } : null;
};
