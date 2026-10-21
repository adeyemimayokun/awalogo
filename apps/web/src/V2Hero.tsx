import type { RefObject } from "react";
import { ArrowRight, ArrowUpRight, Flag, Plus, Search, ShoppingBag, X } from "./icons";
import V2CategoryFilter, { type CategoryOption } from "./V2CategoryFilter";
import { useV2Language } from "./V2Language";

type Props = {
  count: number;
  bagCount: number;
  query: string;
  searchRef: RefObject<HTMLInputElement | null>;
  categories: CategoryOption[];
  selectedCategories: string[];
  onQuery: (query: string) => void;
  onCategory: (category: string) => void;
  onResults: () => void;
  onFlags: () => void;
  onBag: () => void;
  onRequest: () => void;
};

export default function V2Hero({ count, bagCount, query, searchRef, categories, selectedCategories, onQuery, onCategory, onResults, onFlags, onBag, onRequest }: Props) {
  const { t } = useV2Language();
  return <section className="v2-heading v2-brand-hero" aria-labelledby="v2-brand-hero-title">
    <div className="v2-hero-grid" aria-hidden="true">{Array.from({ length:18 }, (_, index) => <i key={index} />)}</div>
    <div className="v2-hero-content">
      <p className="v2-hero-eyebrow">{t("NIGERIAN & AFRICAN BRANDS")}</p>
      <h1 id="v2-brand-hero-title">{t("Brand assets from Nigeria & Africa.")}</h1>
      <p className="v2-description">{t("Explore company logos from Nigeria and across African markets.")}</p>
      <div className="v2-toolbar v2-hero-search">
        <V2CategoryFilter options={categories} selected={selectedCategories} onToggle={onCategory} />
        <div className="v2-search-wrap">
          <label><Search size={20} /><input ref={searchRef} aria-keyshortcuts="/" title={`${t("Search logos and flags")} (/)`} aria-label={t("Search logos and flags")} placeholder={t("Search brands or countries...")} value={query} onChange={(event) => onQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); onResults(); } }} /></label>
          {query ? <button type="button" className="v2-search-clear" title={t("Clear search")} aria-label={t("Clear search")} onClick={() => { onQuery(""); searchRef.current?.focus(); }}><X size={16} /></button> : null}
          <button type="button" className="v2-hero-submit v2-primary" title={t("Search logos and flags")} aria-label={t("Search logos and flags")} onClick={onResults}><ArrowRight size={17} /></button>
        </div>
      </div>
      <nav className="v2-hero-shortcuts" aria-label={t("Browse controls")}>
        <button type="button" onClick={onFlags}><Flag size={17} /><span>{t("Country flags")}</span></button>
        <a href="https://www.figma.com/community/plugin/1661356348996631383" target="_blank" rel="noreferrer"><ArrowUpRight size={17} /><span>{t("Figma plugin")}</span></a>
        <button type="button" onClick={onBag} aria-keyshortcuts="Alt+B" title={`${t("Download bag")} (Alt+B)`}><ShoppingBag size={17} /><span>{t("Download bag")}</span>{bagCount > 0 ? <b>{bagCount}</b> : null}</button>
        <button type="button" onClick={onRequest} aria-keyshortcuts="Alt+R" title={`${t("Request logo")} (Alt+R)`}><Plus size={17} /><span>{t("Request logo")}</span></button>
      </nav>
      <div className="v2-hero-meta"><span><b>{count}</b> {t("brands")}</span><span>{t("One growing library")}</span></div>
    </div>
  </section>;
}
