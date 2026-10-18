import type { BeforeSendEvent } from "@vercel/analytics";

const productionOrigins = new Set(["https://awalogo.com", "https://www.awalogo.com"]);

function publicAnalyticsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const path = decodeURIComponent(url.pathname);
    if (!productionOrigins.has(url.origin) || /^\/(admin|api|auth|requests)(\/|$)/i.test(path) || /^\/v2\/requests(\/|$)/i.test(path)) return null;
    url.search = "";
    url.hash = "";
    return url;
  } catch { return null; }
}

export function shouldTrackAnalytics({ productionBuild, enabled, url, privacyOptOut = false }: { productionBuild:boolean; enabled:string | undefined; url:string; privacyOptOut?:boolean }): boolean {
  return productionBuild && enabled === "true" && !privacyOptOut && publicAnalyticsUrl(url) !== null;
}

export function sanitizeAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;
  const url = publicAnalyticsUrl(event.url);
  return url ? { type:"pageview", url:url.href } : null;
}
