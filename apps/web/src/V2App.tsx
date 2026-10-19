import { formerBrandName, searchedHistoricalVersion } from "./brand-history";
import { paginate, recommendBrands, shortcut } from "./browse-tools";
import affiliations from "../../../packages/brands/research/affiliations.json";
import { cancelActionSounds, initialSound, playActionSound, SOUND_KEY } from "./action-sound";
import { bagReducer, type BagState } from "./bag-actions";
import { assetUrl } from "./asset-url";
import V2Navigation from "./V2Navigation";
import V2BrandCard from "./V2BrandCard";
import V2Pagination from "./V2Pagination";
import V2FloatingBag, { type BagAddition } from "./V2FloatingBag";
import V2CollectionFolder from "./V2CollectionFolder";
import { V2LanguageProvider, useV2Language } from "./V2Language";
import V2Flags, { FlagDetails } from "./V2Flags";
import { flags, flagForSlug, flagSource, type CountryFlag, type FlagAsset } from "./flags-data";
import V2CategoryFilter from "./V2CategoryFilter";
import { filterBrands, toggleCategory } from "./brand-filters";
import V2Report from "./V2Report";
import { brandCategory } from "./brand-category";
import { categoryOptions as getCategoryOptions } from "../../../packages/catalog-ui/src/catalog-categories";
import V2Info, { infoTitles, type InfoPage } from "./V2Info";
import V2Select from "./V2Select";
import { recordDownloads, sortBrands, type BrandSort, type DownloadCounts } from "./popularity";
import { useEffect, useReducer, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Check, Code2, Copy, ExternalLink, Flag, LayoutGrid, Plus, RotateCcw, Search, ShoppingBag, Trash2, X } from "lucide-react";
import { zipSync, strToU8 } from "fflate";
import { logos, expansionBySlug, expansionBrands, industries, matchesBrandScope, operatingMarketsFor, historicalArtworkFor, type LogoWithSvg } from "./v2-brand-data";
import type { RuntimeAsset } from "../../../packages/catalog-ui/src/runtime-catalog";
import "./v2.css";
import "./v2-expansion.css";
import "./v2-fields.css";
import "./v2-topnav.css";
import V2Request from "./V2Request";
import "./v2-compact.css";
import { svgCode } from "./svg-code";
import { usesDarkLogoPreview } from "../../../packages/logos/src/preview";

type Selection = { slug: string; variation: string; format: string };
type ResourceAsset = Omit<RuntimeAsset, "repository_path">;
const BAG_KEY = "awalogo-v2-downloads";
function initialBag(): Selection[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(BAG_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((item): item is Selection => typeof item?.slug === "string" && typeof item?.variation === "string" && typeof item?.format === "string").slice(0, 50) : [];
  } catch { return []; }
}
function formatsFor(item: Selection): ResourceAsset[] {
  const flag = flagForSlug(item.slug);
  if (flag) return flag.variants.find((variant) => variant.id === item.variation)?.formats ?? [];
  const logo = logos.find((entry) => entry.slug === item.slug);
  return item.variation === "primary" ? logo?.formats ?? [] : logo?.variations.find((variation) => variation.id === item.variation)?.formats ?? [];
}
function preview(formats: ResourceAsset[]) { return formats.find((asset) => asset.type === "svg")?.url ?? formats[0]?.url; }
async function fetchAsset(asset: ResourceAsset, signal?: AbortSignal): Promise<Uint8Array> {
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
  return <V2LanguageProvider><V2Workspace /></V2LanguageProvider>;
}

function V2Workspace() {
  const { t, language } = useV2Language();
  const [resource, setResource] = useState<"logos" | "flags">(() => location.pathname === "/v2/flags" ? "flags" : "logos");
  const [selectedFlag, setSelectedFlag] = useState<CountryFlag | null>(() => location.pathname === "/v2/flags" ? flags.find((flag) => flag.code.toLowerCase() === new URLSearchParams(location.search).get("flag")?.toLowerCase()) ?? null : null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string[]>([]);
  const [industry, setIndustry] = useState("");
  const [market, setMarket] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<BrandSort>("popular");
  const [downloadCounts, setDownloadCounts] = useState<DownloadCounts>({});
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/logo-requests?view=popularity", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      if (body.counts && typeof body.counts === "object" && !Array.isArray(body.counts)) {
        setDownloadCounts(Object.fromEntries(Object.entries(body.counts).filter(([, count]) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0)) as DownloadCounts);
      }
    }).catch(() => { /* Editorial ordering remains available offline. */ });
    return () => controller.abort();
  }, []);
  const [selected, setSelected] = useState<LogoWithSvg | null>(() => logos.find((logo) => logo.slug === new URLSearchParams(location.search).get("brand")) ?? null);
  const [variation, setVariation] = useState(() => new URLSearchParams(location.search).get("version") ?? "primary");
  const [format, setFormat] = useState("svg");
  const [codeType, setCodeType] = useState<"html" | "react">("html");
  const [codeMode, setCodeMode] = useState<"image" | "inline">("image");
  const [inlineCode, setInlineCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [collectionState, dispatchBag] = useReducer(bagReducer, undefined, (): BagState => ({ items:initialBag(), undo:null, locked:false }));
  const bag = collectionState.items;
  const undoBag = collectionState.undo;
  const [sound, setSound] = useState(initialSound);
  const [page, setPage] = useState(1);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const soundAction = useRef(false);
  function actionSound(kind: "click" | "pack" | "drop") { soundAction.current = true; if (sound) playActionSound(kind); }
  useEffect(() => { try { localStorage.setItem(SOUND_KEY, sound ? "on" : "off"); } catch { /* Session preference remains active. */ } }, [sound]);
  useEffect(() => { if (!undoBag) return; const timer = setTimeout(() => dispatchBag({ type:"expire" }), Math.max(0, undoBag.until - Date.now())); return () => clearTimeout(timer); }, [undoBag]);
  useEffect(() => { setPage(1); }, [query, category, industry, market, sort]);
  const [bagAddition, setBagAddition] = useState<BagAddition | null>(null);
  const additionId = useRef(0);
  const [bagOpen, setBagOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [infoPage, setInfoPage] = useState<InfoPage | null>(null);
  const [aboutPage, setAboutPage] = useState(() => location.pathname === "/v2/about");
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    try { const saved = localStorage.getItem("awalogo-v2-theme"); return saved === "light" || saved === "dark" ? saved : "system"; } catch { return "system"; }
  });
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => { const media = matchMedia("(prefers-color-scheme: dark)"); const update = () => setSystemDark(media.matches); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  useEffect(() => { try { localStorage.setItem("awalogo-v2-theme", theme); } catch { /* Theme remains active for this session. */ } }, [theme]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!selected && !selectedFlag && !requestOpen && !infoPage) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled):not([tabindex="-1"]), select:not(:disabled), textarea:not(:disabled)') ?? [])];
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", trap); previous?.focus(); };
  }, [selected, selectedFlag, bagOpen, requestOpen, infoPage, reportOpen]);
  useEffect(() => { try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch { /* Session still works when storage is unavailable. */ } }, [bag]);
  useEffect(() => {
    const meta = document.createElement("meta"); meta.name = "robots"; meta.content = "noindex,nofollow"; document.head.append(meta);
    const oldTitle = document.title; document.title = "awalogo V2 | Coming soon";
    return () => { meta.remove(); document.title = oldTitle; };
  }, []);
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(""), 4500); return () => clearTimeout(timer); }, [feedback]);
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.defaultPrevented || event.key !== "Escape") return; if (reportOpen) setReportOpen(false); else { setSelected(null); setBagOpen(false); setRequestOpen(false); setInfoPage(null); setSelectedFlag(null); } }; document.addEventListener("keydown", escape); return () => document.removeEventListener("keydown", escape); }, [reportOpen]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const action = shortcut(event, !!target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
      if (!action || event.defaultPrevented || isRequest) return;
      if (action === "search" && (selected || selectedFlag || requestOpen || infoPage || bagOpen)) return;
      event.preventDefault();
      if (action === "search") { if (resource === "flags") document.querySelector<HTMLInputElement>('.v2-main input')?.focus(); else searchRef.current?.focus(); }
      if (action === "bag") { closePanels(); setBagOpen(!bagOpen); }
      if (action === "request") openRequest();
    };
    document.addEventListener("keydown", handle); return () => document.removeEventListener("keydown", handle);
  });
  const categoryOptions = getCategoryOptions(logos);
  const visible = sortBrands(filterBrands(logos, category, query).filter((brand) => matchesBrandScope(brand.slug, industry, market)), sort, downloadCounts);
  const paginated = !query.trim() && !category.length && !industry && !market;
  const pagination = paginate(visible, page);
  const shown = paginated ? pagination.items : visible;
  const recommendations = recommendBrands(filterBrands(logos, category, "").filter((brand) => matchesBrandScope(brand.slug, industry, market)), visible, query, affiliations);
  function changePage(next: number) { setPage(next); requestAnimationFrame(() => { resultsHeading.current?.focus({ preventScroll:true }); resultsHeading.current?.scrollIntoView({ block:"start", behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }); }
  function changeCategory(value: string) { setCategory((selected) => toggleCategory(selected, value)); }
  function resetFilters() { setQuery(""); setCategory([]); setIndustry(""); setMarket(""); setSort("popular"); searchRef.current?.focus(); }
  const selectedFormats = selected ? (variation === "primary" ? selected.formats : selected.variations.find((entry) => entry.id === variation)?.formats ?? []) : [];
  const asset = selectedFormats.find((entry) => entry.type === format) ?? selectedFormats[0];
  const historicalAsset = selected ? historicalArtworkFor(selected.slug, variation) : undefined;
  useEffect(() => {
    setInlineCode(""); setCodeError("");
    if (codeMode !== "inline" || asset?.type !== "svg" || !selected) return;
    const controller = new AbortController();
    fetchAsset(asset, controller.signal).then((bytes) => setInlineCode(svgCode(new TextDecoder().decode(bytes), codeType, historicalAsset?.brand_name ?? selected.name))).catch((error) => { if (!controller.signal.aborted) setCodeError(error instanceof Error ? error.message : "The SVG could not be loaded"); });
    return () => controller.abort();
  }, [asset?.url, asset?.type, selected, codeMode, codeType]);
  function open(logo: LogoWithSvg) { const historical = searchedHistoricalVersion(logo.variations, query); setReportOpen(false); setSelected(logo); setVariation(historical?.id ?? "primary"); setFormat((historical?.formats ?? logo.formats)[0].type); setBagOpen(false); }
  async function copy(text: string, message = "Copied to clipboard") { try { await navigator.clipboard.writeText(text); setFeedback(message); } catch { setFeedback("Clipboard access failed. Please allow clipboard access and try again."); } }
  function add(item: Selection, source?: HTMLElement) {
    soundAction.current = true;
    if (busy) return;
    if (bag.some((entry) => JSON.stringify(entry) === JSON.stringify(item))) { setFeedback("Already in your download bag"); return; }
    if (bag.length >= 50) { setFeedback("Your bag can hold 50 assets"); return; }
    const image = source?.closest("article,.v2-panel")?.querySelector<HTMLImageElement>(".v2-preview img,.v2-detail-preview img");
    const rect = (image ?? source)?.getBoundingClientRect();
    setBagAddition({ id: ++additionId.current, url: preview(formatsFor(item)), start: rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 } });
    dispatchBag({ type:"pack", item }); setFeedback("Packed into bag"); actionSound("pack");
  }
  function drop(index?: number) { soundAction.current = true; if (busy || !bag.length) return; dispatchBag(index === undefined ? { type:"drop-all", now:Date.now() } : { type:"drop", index }); actionSound("drop"); }
  async function download() { if (!asset || !selected) return; try { const bytes = await fetchAsset(asset); saveBlob(new Blob([bytes.buffer as ArrayBuffer], { type: asset.mime_type }), `${selected.slug}-${variation}.${asset.type}`); void recordDownloads([selected.slug]); setFeedback("Download ready"); } catch (error) { setFeedback(error instanceof Error ? error.message : "Download failed. Please try again."); } }
  async function downloadBag() {
    if (busy || !bag.length) return;
    setBusy(true);
    dispatchBag({ type:"lock", value:true });
    try {
      const files: Record<string, Uint8Array> = {}; let total = 0;
      for (const [index, item] of bag.entries()) {
        const file = formatsFor(item).find((entry) => entry.type === item.format); if (!file) throw new Error("An asset is no longer available. Remove it and try again.");
        setFeedback(t("Preparing {current} of {total}", { current: index + 1, total: bag.length }));
        const bytes = await fetchAsset(file); total += bytes.length;
        if (total > 100 * 1024 * 1024) throw new Error("This bundle exceeds 100 MB. Remove some assets and try again.");
        files[`${item.slug}/${item.variation}.${item.format}`] = bytes;
      }
      files["manifest.json"] = strToU8(JSON.stringify(bag.map((item) => ({ ...item, source: flagForSlug(item.slug) ? flagSource : historicalArtworkFor(item.slug, item.variation)?.source_url ?? logos.find((logo) => logo.slug === item.slug)?.source_url })), null, 2));
      if (bag.some((item) => flagForSlug(item.slug))) {
        const license = await fetch("/flags/v1/LICENSE.txt");
        if (!license.ok) throw new Error("Flag license could not be loaded. Please try again.");
        files["FLAGS-LICENSE.txt"] = strToU8(await license.text());
      }
      files["README.txt"] = strToU8("Logo assets remain trademarks of their respective owners. Refer to manifest.json for sources. Flag artwork is provided under the MIT license included in FLAGS-LICENSE.txt when flags are present. Flag variants use standardized proportions.");
      const zip = zipSync(files, { level: 0 }); saveBlob(new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" }), "awalogo-assets.zip"); const logoSlugs = bag.filter((item) => !flagForSlug(item.slug)).map((item) => item.slug); if (logoSlugs.length) void recordDownloads(logoSlugs); setFeedback("Your download bundle is ready");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Bundle download failed"); } finally { setBusy(false); dispatchBag({ type:"lock", value:false }); }
  }
  function snippet() {
    if (!asset || !selected) return "";
    const url = assetUrl(asset.url);
    const name = historicalAsset?.brand_name ?? selected.name;
    return codeType === "html" ? `<img src="${escapeAttribute(url)}" alt="${escapeAttribute(name)} logo" width="160" loading="lazy" />` : `<img src=${JSON.stringify(url)} alt=${JSON.stringify(`${name} logo`)} width={160} loading="lazy" />`;
  }
  const isRequest = location.pathname === "/v2/requests";
  const darkPreviewUrls = new Set(logos.flatMap((logo) => [
    ...(usesDarkLogoPreview(logo.slug) || expansionBySlug.get(logo.slug)?.preview_background === "dark" ? logo.formats.map((entry) => entry.url) : []),
    ...logo.variations.flatMap((entry) => usesDarkLogoPreview(`${logo.slug}-${entry.id}`) ? entry.formats.map((file) => file.url) : [])
  ]));
  async function copySvg() {
    if (asset?.type !== "svg") return;
    try { const svg = new TextDecoder().decode(await fetchAsset(asset)); await copy(svg, "SVG copied"); } catch { setFeedback("SVG could not be copied. Please try again."); }
  }
  const navigation = <V2Navigation isRequest={isRequest} showCategories={resource === "logos"} onFlags={() => showResource("flags")} category={category}
    categories={categoryOptions}
    total={logos.length} theme={theme} onTheme={setTheme} sound={sound} onSound={() => { soundAction.current = true; if (sound) cancelActionSounds(); setSound(!sound); }} onSearch={() => { if (isRequest || aboutPage) { location.assign("/v2"); return; } closePanels(); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".v2-main .v2-search-wrap input")?.focus()); }} onInfo={(page) => { closePanels(); if (page === "about") { history.pushState(null, "", "/v2/about"); setAboutPage(true); window.scrollTo(0, 0); } else setInfoPage(page); }} onCategory={changeCategory} onRequest={openRequest} onLibrary={() => showResource("logos")} />;
  function closePanels() { setSelectedFlag(null); setSelected(null); setBagOpen(false); setRequestOpen(false); setInfoPage(null); setReportOpen(false); }
  function openRequest() { closePanels(); setRequestOpen(true); }
  function showResource(next: "logos" | "flags") {
    closePanels(); setAboutPage(false); setResource(next);
    const path = next === "flags" ? "/v2/flags" : "/v2";
    if (location.pathname !== path || location.search) history.pushState(null, "", path);
  }
  useEffect(() => {
    const back = () => { closePanels(); setAboutPage(location.pathname === "/v2/about"); setResource(location.pathname === "/v2/flags" ? "flags" : "logos"); };
    window.addEventListener("popstate", back); return () => window.removeEventListener("popstate", back);
  }, []);
  async function downloadFlag(asset: FlagAsset, name: string) {
    try { const bytes = await fetchAsset(asset); saveBlob(new Blob([bytes.buffer as ArrayBuffer], { type: asset.mime_type }), name); setFeedback("Flag download ready"); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Flag download failed. Please try again."); }
  }
  const collectionPreviews = bag.slice(-3).flatMap((item) => {
    const src = preview(formatsFor(item));
    return src ? [{ src, dark: darkPreviewUrls.has(src) }] : [];
  });
  const collection = <>
    <header className="v2-collection-header"><V2CollectionFolder previews={collectionPreviews} /><div><h2>{t("Your collection")}</h2><p>{t("{count} items", { count: bag.length })}</p>{bag.length ? <button className="v2-drop-all" disabled={busy} onClick={() => drop()}><Trash2 size={14} />{t("Drop all")}</button> : null}</div></header>
    <div className="v2-collection-list" tabIndex={0} role="region" aria-label={t("Your collection")}>{bag.length ? bag.map((item, index) => {
      const flag = flagForSlug(item.slug);
      const logo = logos.find((entry) => entry.slug === item.slug);
      const src = preview(formatsFor(item));
      const version = flag ? item.variation.replace("x", ":") : item.variation === "primary" ? t("Primary logo") : logo?.variations.find((entry) => entry.id === item.variation)?.name ?? item.variation;
      return <div className="v2-bag-row" key={`${item.slug}-${item.variation}-${item.format}`}><span className={`v2-collection-thumbnail${src && darkPreviewUrls.has(src) ? " is-dark" : ""}`}><img src={src} alt="" /></span><div><strong>{flag ? `${flag.name} ${t("flag")}` : logo?.name ?? item.slug}</strong><small>{version} · {item.format.toUpperCase()}</small></div><button disabled={busy} title={t("Drop item")} aria-label={`${t("Drop item")}: ${flag?.name ?? logo?.name ?? item.slug}`} onClick={() => drop(index)}><Trash2 size={16} /></button></div>;
    }) : <p className="v2-empty">{t("Your bag is empty. Pack an asset to start a collection.")}</p>}</div>
    {bag.length ? <footer className="v2-collection-footer"><button className="v2-primary" disabled={busy} onClick={downloadBag}><ArrowDownToLine size={17} />{busy ? t("Preparing bundle...") : t("Download ZIP")}<span>{bag.length}</span></button></footer> : null}
  </>;
  return <div className={`v2-app${isRequest ? " v2-request-layout" : ""}`} onClickCapture={() => { soundAction.current = false; }} onClick={(event) => { const command = (event.target as HTMLElement).closest("button,a"); if (sound && !soundAction.current && command && command.matches(".v2-dock-item,.v2-dock-category,.v2-preview,.v2-pagination button,.v2-search-clear,.v2-reset-filters") && !command.hasAttribute("disabled") && !command.closest(".v2-floating-bag")) playActionSound("click"); }} data-v2-theme={theme === "system" ? (systemDark ? "dark" : "light") : theme}>
    <style>{[...darkPreviewUrls].map((url) => `.v2-app :is(.v2-preview,.v2-detail-preview):has(img[src=${JSON.stringify(url)}]){background:#272727}`).join("\n")}</style>
    {navigation}
    <div className="v2-workspace">
    {aboutPage ? <main className="v2-main v2-about-page"><a className="v2-about-back" href="/v2" onClick={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); showResource("logos"); } }}>{t("Brand library")}</a><V2Info page="about" fullPage onBrand={() => {}} onNewest={() => showResource("logos")} onRequest={openRequest} /></main> : isRequest ? <V2Request /> : <main className="v2-main">{resource === "flags" ? <V2Flags busy={busy} onSelect={(flag) => { closePanels(); setSelectedFlag(flag); }} onAdd={add} /> : <><div className="v2-heading"><div><p>{t("NIGERIAN & AFRICAN BRANDS")}</p><h1>{t("Good brands. Ready to use.")}</h1><p className="v2-description">{t("Explore company logos from Nigeria and across African markets.")}</p></div><span>{logos.length} {t("brands")}<br /><small>{t("One growing library")}</small></span></div>
      <div className="v2-toolbar"><div className="v2-search-wrap"><label><Search size={20} /><input ref={searchRef} aria-keyshortcuts="/" title={`${t("Search brands")} (/)`} aria-label={t("Search brands")} placeholder={t("Search brands, banks, fintechs...")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>{query ? <button className="v2-search-clear" title={t("Clear search")} aria-label={t("Clear search")} onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X size={16} /></button> : null}</div><V2CategoryFilter options={categoryOptions} selected={category} onToggle={changeCategory} /></div>
      {category.length ? <div className="v2-filter-chips" aria-label={t("Selected categories")}>{category.map((value) => <button key={value} aria-label={`Remove ${t(value.replaceAll("-", " "))} filter`} onClick={() => changeCategory(value)}><span>{t(value.replaceAll("-", " "))}</span><X size={13} /></button>)}</div> : null}
      <div className="v2-library-layout">
      <div className="v2-library-results">
      <div className="v2-result-line v2-browse-controls" aria-label={t("Browse controls")}><span role="status">{category.length === 0 ? t("All brands") : category.length === 1 ? t(category[0].replaceAll("-", " ")) : t("Selected categories")} <b>{visible.length}</b></span><div className="v2-expansion-filters"><V2Select aria-label={t("Filter by industry")} value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="">{t("All industries")}</option>{industries.map((value) => <option key={value} value={value}>{t(value.replaceAll("-", " "))}</option>)}</V2Select><V2Select aria-label={t("Filter by operating country")} value={market} onChange={(event) => setMarket(event.target.value)}><option value="">{t("All markets")}</option>{[...new Set(["NG", ...expansionBrands.flatMap((brand) => operatingMarketsFor(brand.slug))])].sort().map((code) => <option key={code} value={code}>{new Intl.DisplayNames([language === "pcm" ? "en" : language], { type: "region" }).of(code)}</option>)}</V2Select></div><div className="v2-result-actions">{query || category.length || industry || market || sort !== "popular" ? <button className="v2-reset-filters" aria-label={t("Reset all filters")} title={t("Reset all filters")} onClick={resetFilters}><RotateCcw size={16} /></button> : null}<V2Select aria-label={t("Sort brands")} value={sort} onChange={(event) => setSort(event.target.value as BrandSort)}><option value="popular">{t("Most popular")}</option><option value="name">{t("Name: A-Z")}</option><option value="newest">{t("Newest added")}</option></V2Select></div></div>
      <h2 className="v2-results-heading" tabIndex={-1} ref={resultsHeading}>{t("Brand library")}</h2>
      <div className="v2-grid">{shown.map((logo) => <V2BrandCard key={logo.slug} logo={logo} query={query} busy={busy} onOpen={open} onPack={add} />)}</div>
      {paginated ? <V2Pagination {...pagination} total={visible.length} onChange={changePage} /> : null}
      {!visible.length ? <div className="v2-empty v2-search-empty"><p>{t("No brands match your search. Try another name or category.")}</p><button type="button" className="v2-primary v2-empty-request" onClick={openRequest}><Plus size={16} />{t("Request a missing brand")}</button></div> : null}
      {recommendations.length ? <section className="v2-similar"><h2>{t("Similar brands")}</h2><div className="v2-grid">{recommendations.map(({ brand:logo, related }) => <V2BrandCard key={logo.slug} logo={logo} query={query} busy={busy} reason={related ? "Related company" : "Similar name"} onOpen={open} onPack={add} />)}</div></section> : null}
      </div>
      </div>
    </>}</main>}
    <footer className="v2-footer"><span>{t("V2 / Coming soon")}</span><a href="/">{t("V1 interface")}<ArrowUpRight size={13} /></a><a href="/v2/requests" onClick={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openRequest(); } }}>{t("Missing a brand? Request it")}<ArrowUpRight size={13} /></a></footer>
    </div>
    {selected || selectedFlag || requestOpen || infoPage ? <div className="v2-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { closePanels(); } }}><aside ref={panelRef} className="v2-panel" role="dialog" aria-modal="true" aria-label={selectedFlag ? `${selectedFlag.name} flag` : reportOpen && selected ? `Report logo: ${selected.name}` : infoPage ? t(infoTitles[infoPage]) : requestOpen ? t("Request a brand") : selected?.name ?? "Download bag"}><button className="v2-close" aria-label={t("Close panel")} onClick={() => { closePanels(); }}><X size={22} /></button>
      {selectedFlag ? <FlagDetails busy={busy} key={selectedFlag.code} flag={selectedFlag} onAdd={add} onDownload={downloadFlag} onCopy={copy} readAsset={fetchAsset} /> : reportOpen && selected && asset ? <V2Report key={`${selected.slug}-${variation}-${asset.type}`} name={selected.name} slug={selected.slug} variation={variation} versionName={variation === "primary" ? t("Primary logo") : selected.variations.find((item) => item.id === variation)?.name ?? variation} format={asset.type} onBack={() => setReportOpen(false)} /> : infoPage ? <V2Info page={infoPage} onRequest={openRequest} onNewest={() => { showResource("logos"); setQuery(""); setCategory([]); setIndustry(""); setMarket(""); setSort("newest"); }} onBrand={(slug) => { const logo = logos.find((item) => item.slug === slug); if (logo) { closePanels(); open(logo); } }} /> : requestOpen ? <V2Request embedded onBrowse={closePanels} onSelectBrand={(slug) => { const logo = logos.find((item) => item.slug === slug); if (logo) { setRequestOpen(false); open(logo); } }} /> : <>
      {selected ? <><p className="v2-eyebrow">{t(brandCategory(selected.slug, selected.category))}</p><h2>{selected.name}</h2>{formerBrandName(selected.slug) ? <p className="v2-brand-history">{t("Formerly {name}", { name: formerBrandName(selected.slug)! })}</p> : null}<div className="v2-detail-preview"><img src={preview(selectedFormats)} alt={`${selected.name} ${variation} logo`} /></div><label className="v2-field">{t("Logo version")}<V2Select value={variation} onChange={(event) => { setVariation(event.target.value); setFormat(formatsFor({ slug: selected.slug, variation: event.target.value, format }).at(0)?.type ?? "svg"); }}><option value="primary">{t("Primary logo")}</option>{selected.variations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.status === "old" ? t(" (previous version)") : ""}</option>)}</V2Select></label><div className="v2-formats">{selectedFormats.map((entry) => <button className={asset?.type === entry.type ? "active" : ""} key={entry.type} onClick={() => setFormat(entry.type)}>{entry.type.toUpperCase()}</button>)}</div><div className="v2-actions"><button className="v2-primary" onClick={download}><ArrowDownToLine size={17} />{t("Download")} {asset?.type.toUpperCase()}</button><button disabled={busy} onClick={(event) => asset && add({ slug: selected.slug, variation, format: asset.type }, event.currentTarget)}><Plus size={17} />{t("Pack into bag")}</button></div><section className="v2-code"><div><h3><Code2 size={17} />{t("Use in your project")}</h3><div className="v2-code-language" role="group" aria-label="Code language">{(["html", "react"] as const).map((language) => <button key={language} type="button" aria-pressed={codeType === language} onClick={() => setCodeType(language)}>{language === "html" ? "HTML" : "React"}</button>)}</div></div><pre>{snippet()}</pre><button onClick={() => copy(snippet())}><Copy size={16} />{t("Copy")} {codeType === "html" ? "HTML" : "React"}</button>{asset?.type === "svg" ? <button onClick={copySvg}><Copy size={16} />{t("Copy SVG")}</button> : null}</section>{expansionBySlug.has(selected.slug) ? <section className="v2-brand-provenance"><h3>{t("Brand details")}</h3>{(["origin_country", "headquarters_country"] as const).map((field) => <p key={field}>{field === "origin_country" ? t("Origin") : t("Headquarters")}: {expansionBySlug.get(selected.slug)![field] ? new Intl.DisplayNames([language === "pcm" ? "en" : language], { type: "region" }).of(expansionBySlug.get(selected.slug)![field]!) : t("Not yet confirmed")}</p>)}<p>{t("Confirmed markets:")} {operatingMarketsFor(selected.slug).map((code) => new Intl.DisplayNames([language === "pcm" ? "en" : language], { type: "region" }).of(code)).join(", ")}</p><a href={historicalAsset?.source_url ?? selected.source_url} target="_blank" rel="noreferrer">{t("Artwork source")}<ExternalLink size={14} /></a><p>{historicalAsset ? t("Historical logo. Community-sourced; not officially verified.") : selected.status === "verified" ? t("Sourced from the official website.") : t("Community artwork, manually reviewed. Not officially verified.")} {t("Trademarks belong to their respective owners.")}</p></section> : null}<div className="v2-source"><a href={selected.website} target="_blank" rel="noreferrer">{t("Official website")}<ExternalLink size={14} /></a><button onClick={() => copy(`${location.origin}/v2?brand=${selected.slug}${variation === "primary" ? "" : `&version=${encodeURIComponent(variation)}`}`, "Brand link copied")}><Copy size={14} />{t("Share brand")}</button></div></> : null}

      {selected && asset?.type === "svg" ? <section className="v2-code"><div><h3>{t("Inline SVG code")}</h3><button onClick={() => setCodeMode((mode) => mode === "inline" ? "image" : "inline")}>{codeMode === "inline" ? t("Hide code") : t("Show code")}</button></div>{codeMode === "inline" ? <><p className="v2-eyebrow">{codeType === "react" ? "REACT JSX" : "HTML SVG"}</p>{codeError ? <p role="alert" className="v2-error">{t(codeError)}</p> : <pre>{inlineCode || t("Loading SVG...")}</pre>}<button disabled={!inlineCode} onClick={() => copy(inlineCode, `${codeType === "react" ? "JSX" : "Inline SVG"} copied`)}><Copy size={16} />{t("Copy inline code")}</button></> : null}</section> : null}
      {selected && asset && !reportOpen ? <section className="v2-report-entry"><div><strong>{t("Found an issue?")}</strong><p>{t("Help us keep this artwork accurate.")}</p></div><button onClick={() => setReportOpen(true)}><Flag size={16} />{t("Report logo")}</button></section> : null}
      </>}
    </aside></div> : null}
    <V2FloatingBag count={bag.length} addition={bagAddition} previews={collectionPreviews} panelOpen={!!(selected || selectedFlag || requestOpen || infoPage)} open={bagOpen} onClose={() => setBagOpen(false)} onOpen={() => { closePanels(); setBagOpen(!bagOpen); actionSound("click"); }}>{collection}</V2FloatingBag>
    {feedback ? <div className="v2-toast" role="status"><Check size={16} />{t(feedback)}</div> : null}
    {undoBag ? <div className="v2-undo" role="status"><span>{t("All items dropped")}</span><button disabled={busy} onClick={() => { if (busy) return; dispatchBag({ type:"undo", now:Date.now() }); if (Date.now() < undoBag.until) actionSound("pack"); }}>{t("Undo")}</button></div> : null}
  </div>;
}
