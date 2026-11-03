import sax from "sax";
import * as css from "css-tree";
const SVG = "http://www.w3.org/2000/svg";
const XLINK = "http://www.w3.org/1999/xlink";
const XML = "http://www.w3.org/XML/1998/namespace";
const tags = new Set(`svg g path rect circle ellipse line polyline polygon defs linearGradient radialGradient stop clipPath mask pattern symbol use title desc style text tspan metadata filter feDropShadow marker image`.split(" "));
const attributes = new Set(`id class viewBox width height x y x1 x2 y1 y2 cx cy r rx ry fx fy dx dy d points transform preserveAspectRatio fill fill-rule fill-opacity stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity clip-path clip-rule clipPathUnits mask maskUnits maskContentUnits gradientUnits gradientTransform offset stop-color stop-opacity spreadMethod patternUnits patternContentUnits patternTransform href xlink:href style version role aria-label aria-labelledby aria-hidden focusable alt color color-interpolation-filters filter flood-color flood-opacity stdDeviation font-family font-size font-weight letter-spacing word-spacing text-anchor overflow marker-start marker-mid marker-end markerHeight markerWidth refX refY orient markerUnits enable-background mask-type type xml:space data-name data-testid data-astro-cid-k5dwlr6h`.split(" "));
const properties = new Set(`fill fill-rule fill-opacity stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity clip-path clip-rule color stop-color stop-opacity flood-color flood-opacity filter mask mask-type marker marker-start marker-mid marker-end font-family font-size font-weight letter-spacing word-spacing text-anchor display visibility overflow width height line-height text-indent text-align text-decoration-line text-transform shape-rendering text-rendering image-rendering enable-background mix-blend-mode -inkscape-stroke`.split(" "));
const fragment = /^#[A-Za-z0-9_.:-]+$/;
function fail(message) { throw new Error(`Unsafe SVG (unsafe embedded content): ${message}`); }

// Existing legacy logos contain PNG wrappers. Only structurally bounded PNG data
// is supported, never SVG/HTML data, network URLs, or arbitrary data MIME types.
function embeddedPng(value) {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length > 12_000_000) return false;
  const encoded = value.slice(22);
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  let offset = 8, first = true, data = false;
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset), type = bytes.toString("ascii", offset + 4, offset + 8);
    if (offset + size + 12 > bytes.length || !/^[A-Za-z]{4}$/.test(type)) return false;
    if (first) {
      if (type !== "IHDR" || size !== 13) return false;
      const width = bytes.readUInt32BE(offset + 8), height = bytes.readUInt32BE(offset + 12);
      if (!width || !height || width * height > 40_000_000) return false;
      first = false;
    } else if (type === "IHDR") return false;
    if (type === "IDAT") data = true;
    offset += size + 12;
    if (type === "IEND") return size === 0 && data && offset === bytes.length;
  }
  return false;
}

function validateCss(text, context) {
  // No escapes: CSS escape decoding must never conceal names, URLs or functions.
  if (/[\\\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) fail("CSS escape/control character");
  let ast;
  try { ast = css.parse(text, { context, parseCustomProperty: true, onParseError: () => fail("malformed CSS") }); }
  catch { fail("malformed CSS"); }
  css.walk(ast, (node) => {
    if (node.type === "Raw" || node.type === "Atrule") fail("unsupported CSS syntax");
    if (node.type === "Rule" && node.prelude.type !== "SelectorList") fail("unsupported selector");
    if (node.type.endsWith("Selector") && !["Selector", "ClassSelector", "IdSelector", "TypeSelector"].includes(node.type)) fail("unsupported selector");
    if (node.type === "TypeSelector" && !tags.has(node.name)) fail("unsupported selector");
    if (node.type === "Declaration" && (!properties.has(node.property) || node.important)) fail("unsupported CSS property");
    if (node.type === "Url" && !fragment.test(node.value)) fail("external CSS reference");
    if (node.type === "Function" && !["rgb", "rgba", "hsl", "hsla", "color"].includes(node.name.toLowerCase())) {
      // This existing logo token has a literal fallback and cannot be defined by
      // this policy (custom properties and external stylesheets are forbidden).
      if (node.name !== "var" || !/^var\(--logo-color,#[a-fA-F0-9]{6}\)$/.test(css.generate(node))) fail("unsupported CSS function");
    }
  });
}

/** Validate without serializing, normalizing, or changing source/checksum bytes. */
export function validateSvgSecurity(input) {
  let text;
  try { text = typeof input === "string" ? input : new TextDecoder("utf-8", { fatal: true }).decode(input); }
  catch { fail("invalid UTF-8"); }
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) fail("declaration");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/.test(text)) fail("XML character");
  const parser = sax.parser(true, { xmlns: true, strictEntities: true });
  const stack = [];
  let roots = 0;
  let declaration = false;
  let seenAttributes = new Set();
  parser.onopentagstart = () => { seenAttributes = new Set(); };
  parser.onattribute = ({ name }) => {
    if (seenAttributes.has(name)) fail("duplicate attribute");
    seenAttributes.add(name);
  };
  parser.onerror = () => fail("malformed XML");
  parser.ondoctype = () => fail("DOCTYPE");
  parser.onprocessinginstruction = (pi) => {
    if (declaration || pi.name !== "xml" || roots || stack.length || !/^\ufeff?<\?xml\s+version=(?:"1\.0"|'1\.0')(?:\s+encoding=(?:"[Uu][Tt][Ff]-8"|'[Uu][Tt][Ff]-8'))?(?:\s+standalone=(?:"(?:yes|no)"|'(?:yes|no)'))?\s*\?>/.test(text)) fail("processing instruction");
    declaration = true;
  };
  parser.onopentag = (node) => {
    if (node.prefix || !tags.has(node.name) || (node.uri && node.uri !== SVG)) fail(`element ${node.name}`);
    if (!stack.length) {
      if (++roots !== 1 || node.name !== "svg") fail("root");
      const viewBox = node.attributes.viewBox?.value;
      if (viewBox) {
        if (!/^\s*[-+\d.eE]+[\s,]+[-+\d.eE]+[\s,]+[-+\d.eE]+[\s,]+[-+\d.eE]+\s*$/.test(viewBox)) fail("invalid viewBox");
        const values = viewBox.trim().split(/[\s,]+/).map(Number);
        if (!values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) fail("invalid viewBox");
      } else if (!["width", "height"].every((key) => /^\d+(?:\.\d+)?(?:px)?$/.test(node.attributes[key]?.value ?? "") && parseFloat(node.attributes[key].value) > 0)) fail("viewBox or dimensions required");
    } else if (node.name === "svg" || stack.at(-1).name === "style") fail("nested SVG/style element");
    for (const attribute of Object.values(node.attributes)) {
      const { name, value, prefix, uri } = attribute;
      if (name === "xmlns" && value === SVG) continue;
      if (name === "xmlns:xlink" && value === XLINK) continue;
      if (name === "xmlns:xodm" && value === "http://www.corel.com/coreldraw/odm/2003") continue;
      if (prefix === "xmlns" || name === "xmlns") fail("namespace declaration");
      if (prefix && !((name === "xlink:href" && uri === XLINK) || (name === "xml:space" && uri === XML))) fail("attribute namespace");
      if ((!attributes.has(name) && !["clipPath", "clipRule", "fillRule"].includes(name)) || /[\\\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(`attribute ${name}`);
      if (name === "href" || name === "xlink:href") {
        if (!fragment.test(value) && !(node.name === "image" && embeddedPng(value))) fail("non-fragment reference");
      } else if (name === "style") validateCss(value, "declarationList");
      else if (properties.has(name)) validateCss(`${name}:${value}`, "declarationList");
      if (name === "type" && (node.name !== "style" || value !== "text/css")) fail("style type");
    }
    stack.push({ name: node.name, text: "" });
  };
  const content = (value) => {
    if (!stack.length) { if (value.trim()) fail("text outside root"); }
    else if (stack.at(-1).name === "style") stack.at(-1).text += value;
  };
  parser.ontext = content;
  parser.oncdata = (value) => { if (!stack.length) fail("CDATA outside root"); content(value); };
  parser.onclosetag = () => {
    const node = stack.pop();
    if (node.name === "style") validateCss(node.text, "stylesheet");
  };
  try { parser.write(text).close(); }
  catch (error) {
    if (error.message.startsWith("Unsafe SVG")) throw error;
    fail(error.message);
  }
  if (roots !== 1 || stack.length) fail("incomplete document");
  return input;
}
