const elements = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "defs", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern", "symbol", "use", "title", "desc", "text", "tspan"]);
const reactNames: Record<string, string> = { class: "className", "xml:space": "xmlSpace", "xlink:href": "xlinkHref", "xmlns:xlink": "xmlnsXlink", tabindex: "tabIndex" };

export function svgCode(source: string, language: "html" | "react", name: string): string {
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = parsed.documentElement;
  if (parsed.querySelector("parsererror") || root.localName !== "svg") throw new Error("This asset is not a valid SVG");
  for (const element of [root, ...root.querySelectorAll("*")]) {
    if (!elements.has(element.localName)) throw new Error("This SVG contains elements that cannot be safely copied inline");
    for (const attribute of [...element.attributes]) {
      if (/^on/i.test(attribute.name) || attribute.name === "style") throw new Error("This SVG requires unsupported inline styling or active content");
      if ((attribute.localName === "href" && !attribute.value.startsWith("#")) || /(?:javascript:|data:|https?:|@import)/i.test(attribute.value)) {
        if (attribute.name !== "xmlns" && attribute.name !== "xmlns:xlink") throw new Error("This SVG references an external resource");
      }
      if (/url\s*\(/i.test(attribute.value) && !/^url\(\s*['"]?#[a-z0-9_.:-]+['"]?\s*\)$/i.test(attribute.value.trim())) throw new Error("This SVG has an unsafe paint reference");
    }
  }
  root.setAttribute("role", "img"); root.setAttribute("aria-label", `${name} logo`); root.setAttribute("width", "160"); root.removeAttribute("height");
  if (language === "html") return new XMLSerializer().serializeToString(root);
  function jsx(element: Element): string {
    const attributes = [...element.attributes].map((attribute) => {
      const key = reactNames[attribute.name] ?? (attribute.name.startsWith("aria-") || attribute.name.startsWith("data-") ? attribute.name : attribute.name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()));
      return `${key}={${JSON.stringify(attribute.value)}}`;
    }).join(" ");
    const children = [...element.childNodes].map((node) => node.nodeType === Node.ELEMENT_NODE ? jsx(node as Element) : node.nodeType === Node.TEXT_NODE && node.textContent?.trim() ? `{${JSON.stringify(node.textContent)}}` : "").join("");
    return children ? `<${element.localName} ${attributes}>${children}</${element.localName}>` : `<${element.localName} ${attributes} />`;
  }
  return jsx(root);
}
