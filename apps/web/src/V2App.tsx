import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Check, Code2, Copy, ExternalLink, Plus, Search, ShoppingBag, Trash2, X } from "lucide-react";
import { zipSync, strToU8 } from "fflate";
import { logos, type LogoWithSvg } from "../../../packages/catalog-ui/src/logo-data";
import type { RuntimeAsset } from "../../../packages/catalog-ui/src/runtime-catalog";
import "./v2.css";
import V2Request from "./V2Request";
import { svgCode } from "./svg-code";

type Selection = { slug: string; variation: string; format: string };
const BAG_KEY = "awalogo-v2-downloads";
function initialBag(): Selection[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(BAG_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((item): item is Selection => typeof item?.slug === "string" && typeof item?.variation === "string" && typeof item?.format === "string").slice(0, 50) : [];
  } catch { return []; }
}
function formatsFor(item: Selection): RuntimeAsset[] {
  const logo = logos.find((entry) => entry.slug === item.slug);
  return item.variation === "primary" ? logo?.formats ?? [] : logo?.variations.find((variation) => variation.id === item.variation)?.formats ?? [];
}
function preview(formats: RuntimeAsset[]) { return formats.find((asset) => asset.type === "svg")?.url ?? formats[0]?.url; }
async function fetchAsset(asset: RuntimeAsset, signal?: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(asset.url, { signal });
  if (!response.ok) throw new Error("The asset could not be downloaded");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 100 * 1024 * 1024) throw new Error("The asset exceeds the download limit");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const checksum = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  if (checksum !== asset.checksum) throw new Error("The asset failed its integrity check. Please try again.");
  return bytes;
}
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function escapeAttribute(value: string) { return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"); }

export default function V2App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<LogoWithSvg | null>(() => logos.find((logo) => logo.slug === new URLSearchParams(location.search).get("brand")) ?? null);
  const [variation, setVariation] = useState("primary");
  const [format, setFormat] = useState("svg");
  const [codeType, setCodeType] = useState<"html" | "react">("html");
  const [codeMode, setCodeMode] = useState<"image" | "inline">("image");
  const [inlineCode, setInlineCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [bag, setBag] = useState<Selection[]>(initialBag);
  const [bagOpen, setBagOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!selected && !bagOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select') ?? [])];
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", trap); previous?.focus(); };
  }, [selected, bagOpen]);
  useEffect(() => { try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch { /* Session still works when storage is unavailable. */ } }, [bag]);
  useEffect(() => {
    const meta = document.createElement("meta"); meta.name = "robots"; meta.content = "noindex,nofollow"; document.head.append(meta);
    const oldTitle = document.title; document.title = "awalogo V2 | Coming soon";
    return () => { meta.remove(); document.title = oldTitle; };
  }, []);
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(""), 4500); return () => clearTimeout(timer); }, [feedback]);
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setSelected(null); setBagOpen(false); } }; document.addEventListener("keydown", escape); return () => document.removeEventListener("keydown", escape); }, []);
  const categories = [...new Set(logos.map((logo) => logo.category))].sort();
  const visible = logos.filter((logo) => (category === "all" || logo.category === category) && `${logo.name} ${logo.aliases.join(" ")}`.toLowerCase().includes(query.toLowerCase().trim()));
  const selectedFormats = selected ? (variation === "primary" ? selected.formats : selected.variations.find((entry) => entry.id === variation)?.formats ?? []) : [];
  const asset = selectedFormats.find((entry) => entry.type === format) ?? selectedFormats[0];
  useEffect(() => {
    setInlineCode(""); setCodeError("");
    if (codeMode !== "inline" || asset?.type !== "svg" || !selected) return;
    const controller = new AbortController();
    fetchAsset(asset, controller.signal).then((bytes) => setInlineCode(svgCode(new TextDecoder().decode(bytes), codeType, selected.name))).catch((error) => { if (!controller.signal.aborted) setCodeError(error instanceof Error ? error.message : "The SVG could not be loaded"); });
    return () => controller.abort();
  }, [asset?.url, asset?.type, selected, codeMode, codeType]);
  function open(logo: LogoWithSvg) { setSelected(logo); setVariation("primary"); setFormat(logo.formats[0].type); setBagOpen(false); }
  async function copy(text: string, message = "Copied to clipboard") { try { await navigator.clipboard.writeText(text); setFeedback(message); } catch { setFeedback("Clipboard access failed. Please allow clipboard access and try again."); } }
  function add(item: Selection) { if (bag.some((entry) => JSON.stringify(entry) === JSON.stringify(item))) { setFeedback("Already in your download bag"); return; } if (bag.length >= 50) { setFeedback("Your bag can hold 50 assets"); return; } setBag((items) => [...items, item]); setFeedback("Added to download bag"); }
  async function download() { if (!asset || !selected) return; try { const bytes = await fetchAsset(asset); saveBlob(new Blob([bytes.buffer as ArrayBuffer], { type: asset.mime_type }), `${selected.slug}-${variation}.${asset.type}`); setFeedback("Download ready"); } catch (error) { setFeedback(error instanceof Error ? error.message : "Download failed. Please try again."); } }
  async function downloadBag() {
    setBusy(true);
    try {
      const files: Record<string, Uint8Array> = {}; let total = 0;
      for (const [index, item] of bag.entries()) {
        const file = formatsFor(item).find((entry) => entry.type === item.format); if (!file) throw new Error("An asset is no longer available. Remove it and try again.");
        setFeedback(`Preparing ${index + 1} of ${bag.length}`);
        const bytes = await fetchAsset(file); total += bytes.length;
        if (total > 100 * 1024 * 1024) throw new Error("This bundle exceeds 100 MB. Remove some assets and try again.");
        files[`${item.slug}/${item.variation}.${item.format}`] = bytes;
      }
      files["manifest.json"] = strToU8(JSON.stringify(bag.map((item) => ({ ...item, source: logos.find((logo) => logo.slug === item.slug)?.source_url })), null, 2));
      files["README.txt"] = strToU8("Assets remain trademarks of their respective owners. Refer to the source links in manifest.json for usage guidance.");
      const zip = zipSync(files, { level: 0 }); saveBlob(new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" }), "awalogo-assets.zip"); setFeedback("Your download bundle is ready");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Bundle download failed"); } finally { setBusy(false); }
  }
  function snippet() {
    if (!asset || !selected) return "";
    const url = new URL(asset.url, "https://www.awalogo.com").href;
    return codeType === "html" ? `<img src="${escapeAttribute(url)}" alt="${escapeAttribute(selected.name)} logo" width="160" loading="lazy" />` : `<img src=${JSON.stringify(url)} alt=${JSON.stringify(`${selected.name} logo`)} width={160} loading="lazy" />`;
  }
  if (location.pathname === "/v2/requests") return <div className="v2-app"><V2Request /></div>;
  async function copySvg() {
    if (asset?.type !== "svg") return;
    try { const svg = new TextDecoder().decode(await fetchAsset(asset)); await copy(svg, "SVG copied"); } catch { setFeedback("SVG could not be copied. Please try again."); }
  }
  return <div className="v2-app">
    <header className="v2-header"><a className="v2-wordmark" href="/v2">awalogo<span>V2</span></a><span className="v2-coming">Coming soon</span><nav><a href="/">V1 interface</a><a href="/v2/requests">Request a logo</a><button onClick={() => { setBagOpen(true); setSelected(null); }} aria-label={`Download bag, ${bag.length} assets`}><ShoppingBag size={19} /><span>{bag.length}</span></button></nav></header>
    <main className="v2-main"><div className="v2-heading"><div><p>NIGERIAN BRAND LIBRARY</p><h1>Find your next brand asset.</h1></div><span>{logos.length} brands</span></div>
      <div className="v2-toolbar"><label><Search size={20} /><input aria-label="Search brands" placeholder="Search brands, banks, fintechs..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></div>
      <div className="v2-result-line"><span>{visible.length} results</span><span>Logos & brand assets</span></div>
      <div className="v2-grid">{visible.map((logo) => <article className="v2-brand" key={logo.slug}><button className="v2-preview" onClick={() => open(logo)} aria-label={`View ${logo.name}`}><img loading="lazy" src={preview(logo.formats)} alt={`${logo.name} logo`} /></button><div className="v2-card-label"><button onClick={() => open(logo)}><strong>{logo.name}</strong><small>{logo.category.replaceAll("-", " ")}</small></button><button className="v2-icon" aria-label={`Add ${logo.name} to download bag`} onClick={() => add({ slug: logo.slug, variation: "primary", format: logo.formats[0].type })}><Plus size={18} /></button></div></article>)}</div>
      {!visible.length ? <div className="v2-empty"><p>No brands match your search. Try another name or category.</p><a href="/v2/requests">Request a missing brand</a></div> : null}
    </main>
    <footer className="v2-footer"><span>awalogo / A growing library of Nigerian brands.</span><a href="/v2/requests">Request a brand asset</a><a href="/">Explore V1 <ExternalLink size={13} /></a></footer>
    {selected || bagOpen ? <div className="v2-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setSelected(null); setBagOpen(false); } }}><aside ref={panelRef} className="v2-panel" role="dialog" aria-modal="true" aria-label={selected?.name ?? "Download bag"}><button className="v2-close" aria-label="Close panel" onClick={() => { setSelected(null); setBagOpen(false); }}><X size={22} /></button>
      {selected ? <><p className="v2-eyebrow">{selected.category.replaceAll("-", " ")}</p><h2>{selected.name}</h2><div className="v2-detail-preview"><img src={preview(selectedFormats)} alt={`${selected.name} ${variation} logo`} /></div><label className="v2-field">Logo version<select value={variation} onChange={(event) => { setVariation(event.target.value); setFormat(formatsFor({ slug: selected.slug, variation: event.target.value, format }).at(0)?.type ?? "svg"); }}><option value="primary">Primary logo</option>{selected.variations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.status === "old" ? " (previous version)" : ""}</option>)}</select></label><div className="v2-formats">{selectedFormats.map((entry) => <button className={asset?.type === entry.type ? "active" : ""} key={entry.type} onClick={() => setFormat(entry.type)}>{entry.type.toUpperCase()}</button>)}</div><div className="v2-actions"><button className="v2-primary" onClick={download}><ArrowDownToLine size={17} />Download {asset?.type.toUpperCase()}</button><button onClick={() => asset && add({ slug: selected.slug, variation, format: asset.type })}><Plus size={17} />Add to bag</button></div><section className="v2-code"><div><h3><Code2 size={17} />Use in your project</h3><select aria-label="Code language" value={codeType} onChange={(event) => setCodeType(event.target.value as "html" | "react")}><option value="html">HTML</option><option value="react">React</option></select></div><pre>{snippet()}</pre><button onClick={() => copy(snippet())}><Copy size={16} />Copy {codeType === "html" ? "HTML" : "React"}</button>{asset?.type === "svg" ? <button onClick={copySvg}><Copy size={16} />Copy SVG</button> : null}</section><div className="v2-source"><a href={selected.website} target="_blank" rel="noreferrer">Official website <ExternalLink size={14} /></a><button onClick={() => copy(`${location.origin}/v2?brand=${selected.slug}`, "Brand link copied")}><Copy size={14} />Share brand</button></div></> : <><p className="v2-eyebrow">YOUR COLLECTION</p><h2>Download bag <span>{bag.length}</span></h2>{bag.map((item, index) => <div className="v2-bag-row" key={`${item.slug}-${item.variation}-${item.format}`}><img src={preview(formatsFor(item))} alt="" /><div><strong>{logos.find((logo) => logo.slug === item.slug)?.name ?? item.slug}</strong><small>{item.variation} / {item.format.toUpperCase()}</small></div><button aria-label={`Remove ${item.slug}`} onClick={() => setBag((entries) => entries.filter((_, position) => position !== index))}><Trash2 size={17} /></button></div>)}{bag.length ? <button className="v2-primary" disabled={busy} onClick={downloadBag}><ArrowDownToLine size={17} />{busy ? "Preparing bundle..." : "Download ZIP"}</button> : <p className="v2-empty">Your bag is empty. Add a brand asset to start a collection.</p>}</>}
      {selected && asset?.type === "svg" ? <section className="v2-code"><div><h3>Inline SVG code</h3><button onClick={() => setCodeMode((mode) => mode === "inline" ? "image" : "inline")}>{codeMode === "inline" ? "Hide code" : "Show code"}</button></div>{codeMode === "inline" ? <><p className="v2-eyebrow">{codeType === "react" ? "REACT JSX" : "HTML SVG"}</p>{codeError ? <p role="alert" className="v2-error">{codeError}</p> : <pre>{inlineCode || "Loading SVG..."}</pre>}<button disabled={!inlineCode} onClick={() => copy(inlineCode, `${codeType === "react" ? "JSX" : "Inline SVG"} copied`)}><Copy size={16} />Copy inline code</button></> : null}</section> : null}
    </aside></div> : null}
    {feedback ? <div className="v2-toast" role="status"><Check size={16} />{feedback}</div> : null}
  </div>;
}
