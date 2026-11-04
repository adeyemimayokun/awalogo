import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { CatalogApp, DocsApp, NotFoundApp } from "@awalogo/catalog-ui";
import aboutMarkdown from "../../../docs/content/about.md?raw";
import { analyticsPrivacyOptOut, sanitizeAnalyticsEvent, sanitizeSpeedInsightsEvent, shouldTrackAnalytics } from "./site-analytics";
import { legacyPageUrl, v2RedirectUrl, webRoute } from "./web-route";

const AdminApp = lazy(() => import("@awalogo/catalog-ui/admin").then((module) => ({
  default: module.AdminApp
})));
const V2App = lazy(() => import("./V2App"));
const { pathname, search, hash } = window.location;
const canonicalUrl = v2RedirectUrl(pathname, search, hash);
if (canonicalUrl) window.history.replaceState(window.history.state, "", canonicalUrl);
const legacyUrl = canonicalUrl ? null : legacyPageUrl(pathname, search, hash);
if (legacyUrl) window.location.replace(legacyUrl);
const route = webRoute(legacyUrl ? "/v1" : window.location.pathname);
const isV2Route = route === "v2";

const isAdminRoute = route === "admin";
const isDocsRoute = route === "docs";
const isCatalogRoute = route === "v1";
if (isCatalogRoute) document.title = "awalogo V1 | Nigerian Bank Logos";
const analyticsEnabled = shouldTrackAnalytics({
  productionBuild:import.meta.env.PROD,
  enabled:import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS,
  url:window.location.href,
  privacyOptOut:analyticsPrivacyOptOut()
});
const speedInsightsEnabled = shouldTrackAnalytics({
  productionBuild: import.meta.env.PROD,
  enabled: import.meta.env.VITE_ENABLE_VERCEL_SPEED_INSIGHTS,
  url: window.location.href,
  privacyOptOut: analyticsPrivacyOptOut()
});
if (isAdminRoute) document.documentElement.dataset.admin = "true";

const rootElement = document.getElementById("root")!;
const root = import.meta.hot?.data.root ?? createRoot(rootElement);
if (import.meta.hot) import.meta.hot.data.root = root;

root.render(
  <>
    {isV2Route ? <Suspense fallback={<main>Loading awalogo V2</main>}><V2App /></Suspense> : isAdminRoute ? (
      <Suspense fallback={<main style={{ display: "grid", minHeight: "100vh", placeItems: "center", fontSize: 12 }}>Loading admin</main>}>
        <AdminApp />
      </Suspense>
    ) : isDocsRoute ? (
      <DocsApp aboutMarkdown={aboutMarkdown} />
    ) : isCatalogRoute ? (
      <CatalogApp aboutMarkdown={aboutMarkdown} />
    ) : (
      <NotFoundApp aboutMarkdown={aboutMarkdown} />
    )}
    {analyticsEnabled ? <Analytics mode="production" debug={false} beforeSend={sanitizeAnalyticsEvent} /> : null}
    {speedInsightsEnabled ? <SpeedInsights debug={false} beforeSend={sanitizeSpeedInsightsEvent} /> : null}
  </>
);
