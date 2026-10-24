export type CatalogSort = "name" | "newest";

export function pluginShortcut(event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "isComposing" | "repeat">, editing: boolean) {
  if (editing || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (!event.altKey && event.key === "/") return "search";
  if (event.altKey && event.key.toLowerCase() === "r") return "request";
  if (event.altKey && event.key.toLowerCase() === "b") return "bag";
}

export function buildLogoReportUrl(name: string, slug: string, source: string) {
  const url = new URL("https://github.com/adeyemimayokun/awalogo/issues/new");
  url.searchParams.set("title", `Logo report: ${name}`);
  url.searchParams.set("body", `## Asset\n${name}\n${slug}\n\n## Source\n${source}\n\n## Reason\n<!-- Outdated logo, wrong color, wrong asset, broken download, or other -->\n\n## Details\n\n\n## Official reference\n`);
  return url.href;
}
