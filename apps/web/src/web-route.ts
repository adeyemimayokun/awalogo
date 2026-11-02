export function webRoute(pathname: string): "v2" | "v1" | "admin" | "docs" | "not-found" {
  if (pathname === "/" || pathname === "/v2" || pathname.startsWith("/v2/")) return "v2";
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
