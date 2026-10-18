import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, ChevronDown, Flag, LayoutGrid, Moon, MoreHorizontal, Plus, Search, SlidersHorizontal, Sun } from "lucide-react";
import type { InfoPage } from "./V2Info";
import { CategoryChoices } from "./V2CategoryFilter";
import { useV2Language } from "./V2Language";
import { isLanguage, languages } from "./v2-translations";
import { Languages, Volume2, VolumeX } from "lucide-react";

type Props = {
  isRequest: boolean;
  category: string[];
  categories: Array<{ value: string; count: number }>;
  total: number;
  onCategory: (category: string) => void;
  onRequest: () => void;
  onLibrary: () => void;
  onSearch: () => void;
  onFlags: () => void;
  showCategories: boolean;
  onInfo: (page: InfoPage) => void;
  theme: "light" | "dark" | "system";
  onTheme: (theme: "light" | "dark" | "system") => void;
  sound?: boolean;
  onSound?: () => void;
};

export default function V2Navigation({ isRequest, category, categories, total, onCategory, onRequest, onLibrary, onSearch, onInfo, theme, onTheme, onFlags, showCategories, sound, onSound }: Props) {
  const { t, language, setLanguage } = useV2Language();
  const [menu, setMenu] = useState<"categories" | "more" | "language" | null>(null);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const dark = theme === "dark" || (theme === "system" && systemDark);
  const nextTheme = dark ? "light" : "dark";
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setMenu(null); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        ref.current?.querySelector<HTMLButtonElement>(`button[aria-controls="v2-dock-${menu}"]`)?.focus();
        setMenu(null);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menu]);
  function choose(value: string) {
    onCategory(value);
  }
  return <nav ref={ref} className="v2-dock v2-topnav" aria-label={t("Workspace navigation")} onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setMenu(null);
  }}>
    <a className="v2-topnav-brand" href="/v2" onClick={(event) => { if (!isRequest && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setMenu(null); onLibrary(); } }}>awalogo <small>V2</small></a>
    <div className="v2-topnav-links">
    <a className={`v2-dock-item${!isRequest && showCategories ? " active" : ""}`} title={t("Brand library")} aria-label={t("Brand library")} aria-current={!isRequest && showCategories ? "page" : undefined} href="/v2" onClick={(event) => { if (!isRequest && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setMenu(null); onLibrary(); } }}><LayoutGrid size={18} /><span>{t("Browse")}</span></a>
    {!isRequest && showCategories ? <div className="v2-dock-group">
      <button className={`v2-dock-item${category.length > 0 ? " active" : ""}`} title={t("Categories")} aria-expanded={menu === "categories"} aria-controls="v2-dock-categories" onClick={() => setMenu(menu === "categories" ? null : "categories")}><SlidersHorizontal size={18} /><span>{t("Categories")}</span><ChevronDown size={13} />{category.length > 0 ? <i className="v2-dock-filter-dot" /> : null}</button>
      {menu === "categories" ? <div className="v2-dock-popover" id="v2-dock-categories" aria-label="Brand categories">
        <CategoryChoices options={categories} selected={category} onToggle={choose} onDone={() => { setMenu(null); ref.current?.querySelector<HTMLButtonElement>('button[aria-controls="v2-dock-categories"]')?.focus(); }} />
      </div> : null}
    </div> : null}
    <button className={`v2-dock-item${!showCategories && !isRequest ? " active" : ""}`} aria-current={!showCategories && !isRequest ? "page" : undefined} onClick={() => { setMenu(null); onFlags(); }}><Flag size={17} /><span>{t("Flags")}</span></button>
    <a className="v2-dock-item v2-topnav-plugin" href="https://www.figma.com/community/plugin/1661356348996631383" target="_blank" rel="noreferrer"><span>{t("Figma plugin")}</span><ArrowUpRight size={13} /></a>
    <button className="v2-dock-item v2-dock-updates" title={t("Updates")} onClick={() => { setMenu(null); onInfo("updates"); }}><Bell size={18} /><span>{t("Updates")}</span></button>
    </div>
    <div className="v2-topnav-actions">
    <div className="v2-dock-group">
      <button className="v2-dock-item" aria-label={t("Language")} title={`${t("Language")}: ${languages.find((item) => item.code === language)?.name}`} aria-expanded={menu === "language"} aria-controls="v2-dock-language" onClick={() => setMenu(menu === "language" ? null : "language")}><Languages size={18} /></button>
      {menu === "language" ? <div id="v2-dock-language" className="v2-dock-popover v2-language-menu"><strong>{t("Language")}</strong>{languages.map((item) => <button className="v2-dock-category" key={item.code} lang={item.code} aria-pressed={language === item.code} onClick={() => { if (isLanguage(item.code)) setLanguage(item.code); setMenu(null); ref.current?.querySelector<HTMLButtonElement>('button[aria-controls="v2-dock-language"]')?.focus(); }}>{item.name}<span aria-hidden="true">{language === item.code ? "✓" : ""}</span></button>)}</div> : null}
    </div>
    <button className="v2-dock-item" aria-keyshortcuts="/" title={`${t(showCategories ? "Search brands" : "Search flags")} (/)`} aria-label={t(showCategories ? "Search brands" : "Search flags")} onClick={() => { setMenu(null); onSearch(); }}><Search size={18} /></button>
    <div className="v2-dock-group">
      <button className="v2-dock-item" title={t(`Switch to ${nextTheme} mode`)} aria-label={t(`Switch to ${nextTheme} mode`)} onClick={() => { setMenu(null); onTheme(nextTheme); }}>
        {dark ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    </div>
    <div className="v2-dock-group">
      <button className="v2-dock-item" title={t("More options")} aria-label={t("More options")} aria-expanded={menu === "more"} aria-controls="v2-dock-more" onClick={() => setMenu(menu === "more" ? null : "more")}><MoreHorizontal size={19} /></button>
      {menu === "more" ? <div className="v2-dock-popover v2-dock-more" id="v2-dock-more"><strong>awalogo <small>{t("V2 / Coming soon")}</small></strong><p>{t("{count} brands in the library", { count: total })}</p>
        {onSound ? <button className="v2-dock-category" aria-pressed={sound} onClick={onSound}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}{t("Action sounds")}</button> : null}
        <a href="https://www.figma.com/community/plugin/1661356348996631383" target="_blank" rel="noreferrer">{t("Figma plugin")}<ArrowUpRight size={15} /></a>
        <button className="v2-dock-category" onClick={() => { setMenu(null); onFlags(); }}>{t("Country flags")}</button>
        {(["changelog", "about", "contribute", "help", "usage"] as const).map((page) => <button className="v2-dock-category" key={page} onClick={() => { setMenu(null); onInfo(page); }}>{t(({ changelog: "Changelog", about: "About awalogo", contribute: "Contribute", help: "Help & documentation", usage: "Trademark & usage" })[page])}</button>)}
        <a href="https://github.com/adeyemimayokun/awalogo" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={15} /></a>
        <button className="v2-dock-category" onClick={() => { setMenu(null); onInfo("updates"); }}>{t("Updates")}</button>
        <a href="/">{t("Visit V1 interface")}<ArrowUpRight size={15} /></a></div> : null}
    </div>
    <button className={`v2-dock-item v2-topnav-request${isRequest ? " active" : ""}`} aria-keyshortcuts="Alt+R" title={`${t("Request a brand")} (Alt+R)`} aria-label={t("Request a brand")} onClick={() => { setMenu(null); if (!isRequest) onRequest(); }}><Plus size={18} /><span>{t("Request logo")}</span></button>
    </div>
  </nav>;
}
