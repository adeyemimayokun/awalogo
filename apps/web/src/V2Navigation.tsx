import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, ChevronDown, Flag, LayoutGrid, Moon, MoreHorizontal, Plus, Search, ShoppingBag, SlidersHorizontal, Sun } from "lucide-react";
import type { InfoPage } from "./V2Info";
import { CategoryChoices } from "./V2CategoryFilter";

type Props = {
  isRequest: boolean;
  bagCount: number;
  category: string[];
  categories: Array<{ value: string; count: number }>;
  total: number;
  onCategory: (category: string) => void;
  onBag: () => void;
  onRequest: () => void;
  onLibrary: () => void;
  onSearch: () => void;
  onFlags: () => void;
  showCategories: boolean;
  onInfo: (page: InfoPage) => void;
  theme: "light" | "dark" | "system";
  onTheme: (theme: "light" | "dark" | "system") => void;
};

export default function V2Navigation({ isRequest, bagCount, category, categories, total, onCategory, onBag, onRequest, onLibrary, onSearch, onInfo, theme, onTheme, onFlags, showCategories }: Props) {
  const [menu, setMenu] = useState<"categories" | "more" | null>(null);
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
  return <nav ref={ref} className="v2-dock v2-topnav" aria-label="Workspace navigation" onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setMenu(null);
  }}>
    <a className="v2-topnav-brand" href="/v2" onClick={(event) => { if (!isRequest && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setMenu(null); onLibrary(); } }}>awalogo <small>V2</small></a>
    <div className="v2-topnav-links">
    <a className={`v2-dock-item${!isRequest && showCategories ? " active" : ""}`} title="Brand library" aria-label="Brand library" aria-current={!isRequest && showCategories ? "page" : undefined} href="/v2" onClick={(event) => { if (!isRequest && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setMenu(null); onLibrary(); } }}><LayoutGrid size={18} /><span>Browse</span></a>
    {!isRequest && showCategories ? <div className="v2-dock-group">
      <button className={`v2-dock-item${category.length > 0 ? " active" : ""}`} title="Categories" aria-expanded={menu === "categories"} aria-controls="v2-dock-categories" onClick={() => setMenu(menu === "categories" ? null : "categories")}><SlidersHorizontal size={18} /><span>Categories</span><ChevronDown size={13} />{category.length > 0 ? <i className="v2-dock-filter-dot" /> : null}</button>
      {menu === "categories" ? <div className="v2-dock-popover" id="v2-dock-categories" aria-label="Brand categories">
        <CategoryChoices options={categories} selected={category} onToggle={choose} onDone={() => { setMenu(null); ref.current?.querySelector<HTMLButtonElement>('button[aria-controls="v2-dock-categories"]')?.focus(); }} />
      </div> : null}
    </div> : null}
    <button className={`v2-dock-item${!showCategories && !isRequest ? " active" : ""}`} aria-current={!showCategories && !isRequest ? "page" : undefined} onClick={() => { setMenu(null); onFlags(); }}><Flag size={17} /><span>Flags</span></button>
    <a className="v2-dock-item v2-topnav-plugin" href="https://www.figma.com/community/plugin/1661356348996631383" target="_blank" rel="noreferrer"><span>Figma plugin</span><ArrowUpRight size={13} /></a>
    <button className="v2-dock-item v2-dock-updates" title="Updates" onClick={() => { setMenu(null); onInfo("updates"); }}><Bell size={18} /><span>Updates</span></button>
    </div>
    <div className="v2-topnav-actions">
    <button className="v2-dock-item" title="Search brands" aria-label="Search brands" onClick={() => { setMenu(null); onSearch(); }}><Search size={18} /></button>
    <button className="v2-dock-item" title="Download bag" aria-label={`Download bag${bagCount ? `, ${bagCount} assets` : ""}`} onClick={() => { setMenu(null); onBag(); }}><ShoppingBag size={18} /><span>Bag</span>{bagCount > 0 ? <small>{bagCount}</small> : null}</button>
    <div className="v2-dock-group">
      <button className="v2-dock-item" title={`Switch to ${nextTheme} mode`} aria-label={`Switch to ${nextTheme} mode`} onClick={() => { setMenu(null); onTheme(nextTheme); }}>
        {dark ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    </div>
    <div className="v2-dock-group">
      <button className="v2-dock-item" title="More options" aria-label="More options" aria-expanded={menu === "more"} aria-controls="v2-dock-more" onClick={() => setMenu(menu === "more" ? null : "more")}><MoreHorizontal size={19} /></button>
      {menu === "more" ? <div className="v2-dock-popover v2-dock-more" id="v2-dock-more"><strong>awalogo <small>V2 / Coming soon</small></strong><p>{total} brands in the library</p>
        <a href="https://www.figma.com/community/plugin/1661356348996631383" target="_blank" rel="noreferrer">Figma plugin <ArrowUpRight size={15} /></a>
        <button className="v2-dock-category" onClick={() => { setMenu(null); onFlags(); }}>Country flags</button>
        {(["changelog", "about", "contribute", "help", "usage"] as const).map((page) => <button className="v2-dock-category" key={page} onClick={() => { setMenu(null); onInfo(page); }}>{({ changelog: "Changelog", about: "About awalogo", contribute: "Contribute", help: "Help & documentation", usage: "Trademark & usage" })[page]}</button>)}
        <a href="https://github.com/adeyemimayokun/awalogo" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={15} /></a>
        <button className="v2-dock-category" onClick={() => { setMenu(null); onInfo("updates"); }}>Updates</button>
        <a href="/">Visit V1 interface <ArrowUpRight size={15} /></a></div> : null}
    </div>
    <button className={`v2-dock-item v2-topnav-request${isRequest ? " active" : ""}`} title="Request a brand" aria-label="Request a brand" onClick={() => { setMenu(null); if (!isRequest) onRequest(); }}><Plus size={18} /><span>Request logo</span></button>
    </div>
  </nav>;
}
