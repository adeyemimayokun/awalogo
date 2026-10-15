import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { CatalogApp, DocsApp, NotFoundApp } from "@awalogo/catalog-ui";
import aboutMarkdown from "../../../docs/content/about.md?raw";

const AdminApp = lazy(() => import("@awalogo/catalog-ui/admin").then((module) => ({
  default: module.AdminApp
})));
const V2App = lazy(() => import("./V2App"));
const isV2Route = window.location.pathname === "/v2" || window.location.pathname.startsWith("/v2/");

const isAdminRoute = window.location.pathname.startsWith("/admin");
const isDocsRoute = window.location.pathname === "/docs" || window.location.pathname.startsWith("/docs/");
const isCatalogRoute = window.location.pathname === "/";
const analyticsEnabled = import.meta.env.PROD && import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === "true";
const speedInsightsEnabled = import.meta.env.PROD && import.meta.env.VITE_ENABLE_VERCEL_SPEED_INSIGHTS === "true";
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
    {analyticsEnabled && window.location.pathname !== "/v2/requests" ? <Analytics /> : null}
    {speedInsightsEnabled && window.location.pathname !== "/v2/requests" ? <SpeedInsights /> : null}
  </>
);
