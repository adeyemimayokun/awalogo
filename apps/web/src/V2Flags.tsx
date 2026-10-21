import { useEffect, useRef, useState } from "react";
import { paginate, recommendBrands } from "./browse-tools";
import V2Pagination from "./V2Pagination";
import V2FlagCard from "./V2FlagCard";
import { assetUrl } from "./asset-url";
import { ArrowDownToLine, Copy, ExternalLink, Plus, RotateCcw, Search, X } from "./icons";
import { findFlags, flags, flagSource, type CountryFlag, type FlagAsset } from "./flags-data";
import V2Select from "./V2Select";
import { useV2Language } from "./V2Language";

type Pick = { slug: string; variation: string; format: string };
export default function V2Flags({ onSelect, onAdd, busy = false }: { busy?: boolean; onSelect: (flag: CountryFlag) => void; onAdd: (item: Pick, source?: HTMLElement) => void }) {
  const { t } = useV2Language();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [page, setPage] = useState(1);
  const search = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setPage(1); }, [query, region]);
  const visible = findFlags(query, region);
  const paginated = !query.trim() && region === "all";
  const pagination = paginate(visible, page);
  const shown = paginated ? pagination.items : visible;
  const candidates = findFlags("", region).map((flag) => ({ ...flag, slug:flag.code, aliases:[flag.code] }));
  const similar = recommendBrands(candidates, visible.map((flag) => ({ ...flag, slug:flag.code, aliases:[flag.code] })), query, []);
  function reset() { setQuery(""); setRegion("all"); setPage(1); search.current?.focus(); }
  function changePage(next: number) { setPage(next); requestAnimationFrame(() => { heading.current?.focus({ preventScroll:true }); heading.current?.scrollIntoView({ block:"start", behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }); }
  function card(flag: CountryFlag, recommended = false) {
    return <V2FlagCard key={flag.code} flag={flag} recommended={recommended} busy={busy} onSelect={onSelect} onAdd={onAdd} />;
  }
  return <>
    <div className="v2-heading"><div><p>{t("COUNTRIES & TERRITORIES")}</p><h1>{t("Country flags")}</h1></div><span>{flags.length} {t("flags")}<small>SVG, PNG & WebP</small></span></div>
    <div className="v2-toolbar"><div className="v2-search-wrap"><label><Search size={18} /><input ref={search} aria-keyshortcuts="/" title={`${t("Search flags")} (/)`} aria-label={t("Search flags")} placeholder={t("Search country or code...")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>{query ? <button className="v2-search-clear" aria-label={t("Clear flag search")} title={t("Clear search")} onClick={() => { setQuery(""); search.current?.focus(); }}><X size={16} /></button> : null}</div><V2Select aria-label={t("Filter flags by region")} value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">{t("All regions")}</option>{[...new Set(flags.map((flag) => flag.region))].sort().map((value) => <option key={value} value={value}>{t(value)}</option>)}</V2Select></div>
    <div className="v2-result-line"><span role="status">{visible.length} {visible.length === 1 ? t("flag") : t("flags")}</span>{query || region !== "all" ? <button className="v2-reset-filters" onClick={reset}>{t("Reset filters")}</button> : null}</div>
    <h2 className="v2-results-heading" tabIndex={-1} ref={heading}>{t("Country flags")}</h2>
    <div className="v2-grid">{shown.map((flag) => card(flag))}</div>
    {paginated ? <V2Pagination {...pagination} total={visible.length} onChange={changePage} /> : null}
    {!visible.length ? <div className="v2-empty v2-search-empty"><p>{t("No flags match your filters.")}</p><button type="button" className="v2-primary v2-empty-request" onClick={reset}><RotateCcw size={16} />{t("Reset filters")}</button></div> : null}
    {similar.length ? <section className="v2-similar"><h2>{t("Similar flags")}</h2><div className="v2-grid">{similar.map(({ brand }) => card(brand, true))}</div></section> : null}
    <p className="v2-flags-attribution">{t("Flag artwork:")}<a href={flagSource} target="_blank" rel="noreferrer">flag-icons</a> / <a href="/flags/v1/LICENSE.txt" target="_blank" rel="noreferrer">MIT License</a></p>
  </>;
}

export function FlagDetails({ flag, onAdd, onDownload, onCopy, readAsset, busy = false }: { busy?: boolean; flag: CountryFlag; onAdd: (item: Pick, source?: HTMLElement) => void; onDownload: (asset: FlagAsset, name: string) => void; onCopy: (value: string, feedback?: string) => Promise<void>; readAsset: (asset: FlagAsset) => Promise<Uint8Array> }) {
  const { t } = useV2Language();
  const [ratio, setRatio] = useState("4x3");
  const [format, setFormat] = useState("svg");
  const [language, setLanguage] = useState<"html" | "react">("html");
  const [error, setError] = useState("");
  useEffect(() => setError(""), [ratio, format]);
  const variant = flag.variants.find((item) => item.id === ratio)!;
  const asset = variant.formats.find((item) => item.type === format)!;
  const url = assetUrl(asset.url);
  const alt = `${flag.name} flag`;
  const snippet = language === "html" ? `<img src="${url}" alt="${alt.replaceAll('"', "&quot;")}" width="${ratio === "4x3" ? 64 : 48}" />` : `<img src=${JSON.stringify(url)} alt=${JSON.stringify(alt)} width={${ratio === "4x3" ? 64 : 48}} />`;
  return <><p className="v2-eyebrow">{t("COUNTRY FLAG /")} {flag.code}</p><h2>{flag.name}</h2><div className="v2-detail-preview v2-flag-detail"><img src={asset.url} alt={alt} /></div>
    <label className="v2-field">{t("Flag variant")}<V2Select value={ratio} onChange={(event) => setRatio(event.target.value)}>{flag.variants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</V2Select></label>
    <div className="v2-formats">{variant.formats.map((item) => <button className={format === item.type ? "active" : ""} key={item.type} onClick={() => setFormat(item.type)}>{item.type.toUpperCase()}</button>)}</div>
    <div className="v2-actions"><button className="v2-primary" onClick={() => onDownload(asset, `${flag.code.toLowerCase()}-${ratio}.${asset.type}`)}><ArrowDownToLine size={16} />{t("Download")} {asset.type.toUpperCase()}</button><button disabled={busy} onClick={(event) => onAdd({ slug: `flag-${flag.code.toLowerCase()}`, variation: ratio, format }, event.currentTarget)}><Plus size={16} />{t("Pack into bag")}</button></div>
    <div className="v2-flag-meta"><span>{t("Country code")}<strong>{flag.code}</strong></span><span>{t("Region")}<strong>{t(flag.region)}</strong></span><span>{t("Dimensions")}<strong>{asset.width} × {asset.height}</strong></span><span>{t("Artwork license")}<strong>MIT</strong></span></div>
    <section className="v2-code"><div><h3>{t("Use in your project")}</h3><div className="v2-code-language" role="group" aria-label="Flag code language">{(["html", "react"] as const).map((value) => <button key={value} aria-pressed={language === value} onClick={() => setLanguage(value)}>{value === "html" ? "HTML" : "React"}</button>)}</div></div><pre>{snippet}</pre><button onClick={() => onCopy(snippet, "Flag code copied")}><Copy size={15} />{t("Copy")} {language === "html" ? "HTML" : "React"}</button>{asset.type === "svg" ? <button onClick={async () => { try { await onCopy(new TextDecoder().decode(await readAsset(asset)), "Flag SVG copied"); } catch { setError("The SVG could not be loaded. Please try again."); } }}><Copy size={15} />{t("Copy SVG")}</button> : null}{error ? <p role="alert" className="v2-error">{t(error)}</p> : null}</section>
    <div className="v2-source"><a href={flagSource} target="_blank" rel="noreferrer">{t("Artwork source")}<ExternalLink size={14} /></a><button onClick={() => onCopy(`${location.origin}/v2/flags?flag=${flag.code.toLowerCase()}`, "Flag link copied")}><Copy size={14} />{t("Share flag")}</button></div><p className="v2-flags-attribution">{t("Standardized 4:3 and square artwork, not a guarantee of official national proportions.")}<a href="/flags/v1/LICENSE.txt" target="_blank" rel="noreferrer">MIT License</a></p>
  </>;
}
