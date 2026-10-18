import { useEffect, useState } from "react";
import { ArrowDownToLine, Copy, ExternalLink, Plus, Search, X } from "lucide-react";
import { findFlags, flags, flagSource, type CountryFlag, type FlagAsset } from "./flags-data";
import V2Select from "./V2Select";

type Pick = { slug: string; variation: string; format: string };
export default function V2Flags({ onSelect, onAdd }: { onSelect: (flag: CountryFlag) => void; onAdd: (item: Pick) => void }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const visible = findFlags(query, region);
  return <>
    <div className="v2-heading"><div><p>COUNTRIES & TERRITORIES</p><h1>Country flags</h1></div><span>{flags.length} flags<small>SVG, PNG & WebP</small></span></div>
    <div className="v2-toolbar"><div className="v2-search-wrap"><label><Search size={18} /><input aria-label="Search flags" placeholder="Search country or code..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>{query ? <button className="v2-search-clear" aria-label="Clear flag search" title="Clear search" onClick={() => setQuery("")}><X size={16} /></button> : null}</div><V2Select aria-label="Filter flags by region" value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">All regions</option>{[...new Set(flags.map((flag) => flag.region))].sort().map((value) => <option key={value}>{value}</option>)}</V2Select></div>
    <div className="v2-result-line"><span role="status">{visible.length} {visible.length === 1 ? "flag" : "flags"}</span>{query || region !== "all" ? <button className="v2-reset-filters" onClick={() => { setQuery(""); setRegion("all"); }}>Reset filters</button> : null}</div>
    <div className="v2-grid">{visible.map((flag) => <article className="v2-brand" key={flag.code}><button className="v2-preview v2-flag-preview" aria-label={`View ${flag.name} flag`} onClick={() => onSelect(flag)}><img src={flag.variants[0].formats[0].url} loading="lazy" alt={`${flag.name} flag`} width={104} height={78} /></button><div className="v2-card-label"><button onClick={() => onSelect(flag)}><strong>{flag.name}</strong><small>{flag.code} / {flag.region}</small></button><button className="v2-icon" title={`Add ${flag.name} flag to bag`} aria-label={`Add ${flag.name} flag to bag`} onClick={() => onAdd({ slug: `flag-${flag.code.toLowerCase()}`, variation: "4x3", format: "svg" })}><Plus size={18} /></button></div></article>)}</div>
    {!visible.length ? <p className="v2-empty">No flags match your filters.</p> : null}
    <p className="v2-flags-attribution">Flag artwork: <a href={flagSource} target="_blank" rel="noreferrer">flag-icons</a> / <a href="/flags/v1/LICENSE.txt" target="_blank" rel="noreferrer">MIT License</a></p>
  </>;
}

export function FlagDetails({ flag, onAdd, onDownload, onCopy, readAsset }: { flag: CountryFlag; onAdd: (item: Pick) => void; onDownload: (asset: FlagAsset, name: string) => void; onCopy: (value: string, feedback?: string) => Promise<void>; readAsset: (asset: FlagAsset) => Promise<Uint8Array> }) {
  const [ratio, setRatio] = useState("4x3");
  const [format, setFormat] = useState("svg");
  const [language, setLanguage] = useState<"html" | "react">("html");
  const [error, setError] = useState("");
  useEffect(() => setError(""), [ratio, format]);
  const variant = flag.variants.find((item) => item.id === ratio)!;
  const asset = variant.formats.find((item) => item.type === format)!;
  const url = new URL(asset.url, "https://www.awalogo.com").href;
  const alt = `${flag.name} flag`;
  const snippet = language === "html" ? `<img src="${url}" alt="${alt.replaceAll('"', "&quot;")}" width="${ratio === "4x3" ? 64 : 48}" />` : `<img src=${JSON.stringify(url)} alt=${JSON.stringify(alt)} width={${ratio === "4x3" ? 64 : 48}} />`;
  return <><p className="v2-eyebrow">COUNTRY FLAG / {flag.code}</p><h2>{flag.name}</h2><div className="v2-detail-preview v2-flag-detail"><img src={asset.url} alt={alt} /></div>
    <label className="v2-field">Flag variant<V2Select value={ratio} onChange={(event) => setRatio(event.target.value)}>{flag.variants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</V2Select></label>
    <div className="v2-formats">{variant.formats.map((item) => <button className={format === item.type ? "active" : ""} key={item.type} onClick={() => setFormat(item.type)}>{item.type.toUpperCase()}</button>)}</div>
    <div className="v2-actions"><button className="v2-primary" onClick={() => onDownload(asset, `${flag.code.toLowerCase()}-${ratio}.${asset.type}`)}><ArrowDownToLine size={16} />Download {asset.type.toUpperCase()}</button><button onClick={() => onAdd({ slug: `flag-${flag.code.toLowerCase()}`, variation: ratio, format })}><Plus size={16} />Add to bag</button></div>
    <div className="v2-flag-meta"><span>Country code<strong>{flag.code}</strong></span><span>Region<strong>{flag.region}</strong></span><span>Dimensions<strong>{asset.width} × {asset.height}</strong></span><span>Artwork license<strong>MIT</strong></span></div>
    <section className="v2-code"><div><h3>Use in your project</h3><div className="v2-code-language" role="group" aria-label="Flag code language">{(["html", "react"] as const).map((value) => <button key={value} aria-pressed={language === value} onClick={() => setLanguage(value)}>{value === "html" ? "HTML" : "React"}</button>)}</div></div><pre>{snippet}</pre><button onClick={() => onCopy(snippet, "Flag code copied")}><Copy size={15} />Copy {language === "html" ? "HTML" : "React"}</button>{asset.type === "svg" ? <button onClick={async () => { try { await onCopy(new TextDecoder().decode(await readAsset(asset)), "Flag SVG copied"); } catch { setError("The SVG could not be loaded. Please try again."); } }}><Copy size={15} />Copy SVG</button> : null}{error ? <p role="alert" className="v2-error">{error}</p> : null}</section>
    <div className="v2-source"><a href={flagSource} target="_blank" rel="noreferrer">Artwork source <ExternalLink size={14} /></a><button onClick={() => onCopy(`${location.origin}/v2/flags?flag=${flag.code.toLowerCase()}`, "Flag link copied")}><Copy size={14} />Share flag</button></div><p className="v2-flags-attribution">Standardized 4:3 and square artwork, not a guarantee of official national proportions. <a href="/flags/v1/LICENSE.txt" target="_blank" rel="noreferrer">MIT License</a></p>
  </>;
}
