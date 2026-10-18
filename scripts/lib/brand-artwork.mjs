// Prefer the company's header identity over customer, payment and partner marks.
export function discoverBrandArtwork($, pageUrl, name) {
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  const candidates = [];
  $("img").each((_, element) => {
    const image = $(element);
    const src = image.attr("data-src") || image.attr("data-lazy-src") || image.attr("src") || image.attr("srcset")?.split(",")[0]?.trim().split(/\s+/)[0] || "";
    const identity = `${image.attr("alt") || ""} ${image.attr("class") || ""} ${image.attr("id") || ""} ${src}`;
    const logoWrapper = image.closest("[data-widget_type*=site-logo],[class*=site-logo],div[class*=logo-container],a[class*=logo]").length > 0;
    if ((!/logo|brand/i.test(identity) && !logoWrapper) || /favicon|icon-\d|\.gif|^data:/i.test(src)) return;
    try {
      const url = new URL(src, pageUrl);
      if (url.protocol !== "https:") return;
      const header = image.closest("header,nav,[class*=header],[id*=header]").length > 0;
      const score = (header ? 30 : 0) + (tokens.some((token) => identity.toLowerCase().includes(token)) ? 20 : 0) - (/partner|client|customer|payment|sponsor/i.test(identity) ? 40 : 0);
      candidates.push({ url: url.href, score });
    } catch { /* Ignore loading placeholders and malformed source URLs. */ }
  });
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") || "";
    if (!/logo/i.test(href) || !/\.(svg|png|webp|jpe?g)(?:\?|$)/i.test(href)) return;
    try {
      const url = new URL(href, pageUrl);
      if (url.protocol === "https:") candidates.push({ url: url.href, score: 60 });
    } catch { /* Invalid download link. */ }
  });
  $("svg").each((index, element) => {
    const svg = $(element);
    const identity = `${svg.attr("class") || ""} ${svg.attr("id") || ""} ${svg.attr("aria-label") || ""} ${svg.find("title").text()} ${svg.parent().attr("class") || ""}`;
    const namedIcon = tokens.some((token) => identity.toLowerCase().includes(token)) && /icon|icn/i.test(identity);
    if ((!/logo|brand/i.test(identity) && !namedIcon) || !svg.attr("viewBox")) return;
    svg.attr("xmlns", "http://www.w3.org/2000/svg");
    candidates.push({ url: `${pageUrl.split("#")[0]}#inline-logo-${index}`, bytes: Buffer.from($.html(svg)), score: 50 });
  });
  return [...new Map(candidates.sort((a, b) => b.score - a.score).map((candidate) => [candidate.url, candidate])).values()].slice(0, 12);
}
