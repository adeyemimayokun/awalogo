// Prefer the company's header identity over customer, payment and partner marks.
function largestSrcset(value) {
  return (value || "").split(",").map((candidate) => {
    const [url, descriptor = "1x"] = candidate.trim().split(/\s+/);
    return { url, size: Number.parseFloat(descriptor) || 1 };
  }).filter((candidate) => candidate.url && !candidate.url.startsWith("data:")).sort((a, b) => b.size - a.size)[0]?.url;
}

export function discoverBrandArtwork($, pageUrl, name) {
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  const candidates = [];
  $("img").each((_, element) => {
    const image = $(element);
    const src = image.attr("data-src") || image.attr("data-lazy-src") || largestSrcset(image.attr("srcset")) || image.attr("src") || "";
    const identity = `${image.attr("alt") || ""} ${image.attr("class") || ""} ${image.attr("id") || ""} ${src.startsWith("data:") ? "embedded image" : src}`;
    const header = image.closest("header,nav,[class*=header],[id*=header]").length > 0;
    const namedHeader = header && tokens.some((token) => (image.attr("alt") || "").toLowerCase().includes(token));
    const logoWrapper = image.closest("[data-widget_type*=site-logo],[class*=site-logo],div[class*=logo-container],a[class*=logo]").length > 0;
    const homeHref = image.parent("a[href]").attr("href");
    const homeLogo = header && (homeHref === "/" || homeHref === new URL("/", pageUrl).href);
    if ((!/logo|brand/i.test(identity) && !logoWrapper && !namedHeader && !homeLogo) || /favicon|icon-\d|\.gif/i.test(src)) return;
    const score = (header ? 60 : 0) + (tokens.some((token) => identity.toLowerCase().includes(token)) ? 20 : 0) - (/partner|client|customer|payment|sponsor|app.?store|google.?play/i.test(identity) ? 60 : 0) - (/footer|logo.?mark|symbol/i.test(identity) ? 20 : 0);
    if (src.startsWith("data:")) {
      if (!header || !(namedHeader || logoWrapper || homeLogo) || src.length > 7000000 || !/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(src)) return;
      candidates.push({ url: `${pageUrl.split("#")[0]}#embedded-header-logo-${candidates.length}`, bytes: Buffer.from(src.slice(src.indexOf(",") + 1), "base64"), score });
      return;
    }
    try {
      const url = new URL(src, pageUrl);
      if (url.protocol !== "https:") return;
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
