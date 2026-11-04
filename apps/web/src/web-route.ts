const publicPages = ["/", "/flags", "/about", "/requests", "/developers"] as const;

export function publicPath(pathname: string) {
  return pathname.replace(/\/$/, "") || "/";
}

export function v2RedirectUrl(pathname: string, search: string, hash: string): string | null {
  const path = publicPath(pathname);
  if (path !== "/v2" && !path.startsWith("/v2/")) return null;
  const target = publicPath(path.slice(3));
  return publicPages.some((page) => page === target) ? target + search + hash : null;
}

export function webRoute(pathname: string): "v2" | "v1" | "admin" | "docs" | "not-found" {
  if (publicPages.some((page) => page === publicPath(pathname))) return "v2";
  if (pathname === "/v1" || pathname === "/v1/") return "v1";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return "docs";
  return "not-found";
}

export function legacyPageUrl(pathname: string, search: string, hash = ""): string | null {
  if (pathname !== "/") return null;
  const query = new URLSearchParams(search);
  if (!query.get("logo") && query.get("request") !== "true" && query.get("new") !== "true") return null;
  return `/v1${search}${hash}`;
}
