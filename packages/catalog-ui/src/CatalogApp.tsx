import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownAZ,
  ArrowUpFromLine,
  ArrowUpAZ,
  ArrowUpRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  ChartLine,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileCode2,
  FileImage,
  History,
  Image as ImageIcon,
  Images,
  Landmark,
  Layers3,
  LayoutGrid,
  Lock,
  LockOpen,
  MessageSquarePlus,
  Network,
  RadioTower,
  RefreshCw,
  Search,
  Send,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  WalletCards,
  X,
  type LucideIcon
} from "lucide-react";
import { getCatalogLogoBadge, usesDarkLogoPreview, type LogoFormatType } from "@awalogo/core";
import type { InstitutionCategory } from "@awalogo/institutions";
import {
  availableInstitutionCategories,
  availableLogoCount,
  categoryLabel,
  explorerCatalogItems,
  logoCatalogItems,
  type CatalogItem
} from "./catalog-data";
import { compareCatalogResults, searchScore, type CatalogSortDirection } from "./catalog-search";
import changelogJson from "./changelog.json";
import { buildCompanyLogoSubmissionUrl } from "./logo-request";
import type { LogoAsset } from "./logo-data";
import { SiteFooter, SiteHeader, type ThemeMode } from "./SiteChrome";
import "./styles.css";

declare const __NBL_SURFACE__: "web" | "plugin";

export type CatalogPluginResponse =
  | { type: "inserted"; name: string }
  | { type: "inserted-in-frame"; name: string }
  | { type: "replaced"; name: string }
  | { type: "clipped"; name: string }
  | { type: "error"; message: string };

export type CatalogPluginRequest =
  | { type: "insert-logo"; name: string; svg: string; width: number; height: number }
  | { type: "insert-image"; name: string; mimeType: "image/png" | "image/webp" | "image/jpeg"; bytes: number[]; width: number; height: number };

export type CatalogPluginBridge = {
  post: (message: CatalogPluginRequest) => boolean;
  subscribe: (handler: (message: CatalogPluginResponse) => void) => () => void;
};

export type ProjectPanel = "about" | "changelog" | "contribute" | "request" | "trademarks";
type LogoDimensions = { width: number; height: number };

function getSharedLogoItem(search: string): CatalogItem | null {
  const logoSlug = new URLSearchParams(search).get("logo");
  if (!logoSlug) return null;
  return explorerCatalogItems.find((item) => item.logo?.slug === logoSlug) ?? null;
}

function setSharedLogoLocation(logoSlug: string | null): void {
  const url = new URL(window.location.href);
  if (logoSlug) url.searchParams.set("logo", logoSlug);
  else url.searchParams.delete("logo");
  url.searchParams.delete("asset");
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) window.history.pushState(null, "", next);
}

function buildLogoShareUrl(logoSlug: string, assetId: string): string {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("logo", logoSlug);
  if (assetId !== "primary") url.searchParams.set("asset", assetId);
  return url.toString();
}

type ChangelogRelease = {
  version: string;
  date: string;
  title: string;
  changes: readonly string[];
  status: "draft" | "published";
};

type AboutBlock =
  | { type: "heading"; content: string }
  | { type: "paragraph"; content: string };

const DEFAULT_PAGE_SIZE = 48;
const PAGE_SIZE_OPTIONS = [24, 48, 100] as const;
const THEME_STORAGE_KEY = "awalogo-theme";

type PaginationItem = number | "start-ellipsis" | "end-ellipsis";

function paginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 4) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 2) return [1, 2, "end-ellipsis", totalPages];
  if (currentPage >= totalPages - 1) return [1, "start-ellipsis", totalPages - 1, totalPages];
  return [1, "start-ellipsis", currentPage, "end-ellipsis", totalPages];
}

function parseAboutMarkdown(markdown: string): AboutBlock[] {
  const blocks: AboutBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", content: paragraph.join(" ") });
    paragraph = [];
  };

  for (const sourceLine of markdown.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line) {
      flushParagraph();
    } else if (line.startsWith("# ")) {
      flushParagraph();
    } else if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push({ type: "heading", content: line.slice(3) });
    } else {
      paragraph.push(line);
    }
  }

  flushParagraph();
  return blocks;
}

function renderAboutInline(content: string): ReactNode[] {
  return content
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
      }

      const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (link) {
        return <a key={`${part}-${index}`} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
      }

      return part;
    });
}
const publishedChangelog = (changelogJson as ChangelogRelease[])
  .filter((release) => release.status === "published")
  .sort((left, right) => right.date.localeCompare(left.date));
const categoryIcons: Partial<Record<InstitutionCategory, LucideIcon>> = {
  "commercial-bank": Landmark,
  "development-finance-institution": Building2,
  "digital-broker": ChartLine,
  "digital-lender": BadgeDollarSign,
  "financial-holding-company": Layers3,
  "finance-app": Smartphone,
  "insurance-broker": BriefcaseBusiness,
  "insurer": ShieldCheck,
  "investment-manager": WalletCards,
  "merchant-bank": Landmark,
  "microfinance-bank": Building2,
  "mobile-money-operator": Smartphone,
  "non-interest-bank": Landmark,
  "payment-service-holding-company": Layers3,
  "payment-service-bank": WalletCards,
  "remittance-imto": Send,
  "regulator": Scale,
  "super-agent": Network,
  "switching-processing": RefreshCw,
  "stockbroker": ChartLine
};
const formatIcons: Record<LogoFormatType, LucideIcon> = {
  svg: FileCode2,
  png: FileImage,
  webp: Images,
  jpeg: ImageIcon
};
const categoryCounts = new Map(availableInstitutionCategories.map((category) => [
  category,
  explorerCatalogItems.filter((item) => item.categories.includes(category)).length
]));
const availableFormatCount = new Set(logoCatalogItems.flatMap((item) =>
  item.logo.formats.map((format) => format.type)
)).size;
const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos"
});
const latestLogoAddedAt = explorerCatalogItems.reduce((latest, item) => {
  const addedAt = item.logo?.added_at;
  return item.logo?.status === "verified" && addedAt && addedAt > latest ? addedAt : latest;
}, "");
const newlyAddedLogoItems = explorerCatalogItems.filter((item) =>
  getCatalogLogoBadge(item.logo, latestLogoAddedAt) === "new"
);
const newlyAddedLogoCount = newlyAddedLogoItems.length;

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00+01:00`));
}

function getSourceDomain(sourceUrl: string) {
  return new URL(sourceUrl).hostname.replace(/^www\./, "");
}

function getAvailableFormats(logo: LogoAsset) {
  return logo.formats.map((format) => format.type.toUpperCase()).join(" · ");
}

function getCategorySummary(categories: InstitutionCategory[]) {
  return categories.map(categoryLabel).join(" · ");
}

function getInstitutionInitials(name: string) {
  const words = name
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return "NG";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function previewUrl(logo: LogoAsset) {
  return logo.asset_urls.png ?? logo.asset_urls.webp ?? logo.asset_urls.jpeg ?? "";
}

async function copyTextToClipboard(text: string, preferLegacyFallback = false) {
  if (!preferLegacyFallback && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Restricted plugin iframes can expose the API while denying the write.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Text clipboard is unavailable");
}

function svgAtDimensions(svg: string, dimensions: LogoDimensions) {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) throw new Error("SVG is malformed");
  const root = documentNode.documentElement;
  if (root.tagName.toLowerCase() !== "svg") throw new Error("SVG root is missing");

  if (!root.hasAttribute("viewBox")) {
    const sourceWidth = Number.parseFloat(root.getAttribute("width") ?? "");
    const sourceHeight = Number.parseFloat(root.getAttribute("height") ?? "");
    if (Number.isFinite(sourceWidth) && sourceWidth > 0 && Number.isFinite(sourceHeight) && sourceHeight > 0) {
      root.setAttribute("viewBox", `0 0 ${sourceWidth} ${sourceHeight}`);
    }
  }

  root.setAttribute("width", String(dimensions.width));
  root.setAttribute("height", String(dimensions.height));
  return new XMLSerializer().serializeToString(root);
}

function getInitialTheme(): ThemeMode {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") return storedTheme;
  } catch {
    // Figma or browser privacy settings may disable storage.
  }
  return "system";
}

export function CatalogApp({
  pluginBridge,
  aboutMarkdown = ""
}: {
  pluginBridge?: CatalogPluginBridge;
  aboutMarkdown?: string;
}) {
  const pluginMode = __NBL_SURFACE__ === "plugin";
  const initialSharedItem = pluginMode ? null : getSharedLogoItem(window.location.search);
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<InstitutionCategory[]>([]);
  const [draftCategories, setDraftCategories] = useState<InstitutionCategory[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(initialSharedItem);
  const [selectedFormat, setSelectedFormat] = useState<LogoFormatType>(initialSharedItem?.logo?.formats[0]?.type ?? "svg");
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState("");
  const [projectPanel, setProjectPanel] = useState<ProjectPanel | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [sortDirection, setSortDirection] = useState<CatalogSortDirection>("asc");
  const [newLogosOnly, setNewLogosOnly] = useState(() => new URLSearchParams(window.location.search).get("new") === "true");

  useLayoutEffect(() => {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = themeMode === "system" ? (systemTheme.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themeMode = themeMode;
    };

    applyTheme();
    if (themeMode === "system") systemTheme.addEventListener("change", applyTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Keep the active session theme when persistence is unavailable.
    }

    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [themeMode]);

  useEffect(() => {
    if (!pluginMode || !pluginBridge) return;
    return pluginBridge.subscribe((message) => {
      setToast(message.type === "inserted"
        ? `${message.name} inserted`
        : message.type === "inserted-in-frame"
          ? `${message.name} inserted into selected frame`
        : message.type === "replaced"
          ? `Selected logo replaced with ${message.name}`
        : message.type === "clipped"
          ? `${message.name} clipped to selected shape`
          : message.message);
    });
  }, [pluginBridge, pluginMode]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDetails();
        setProjectPanel(null);
        setCategoriesExpanded(false);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    if (pluginMode) return;
    function restoreSharedLogo() {
      const item = getSharedLogoItem(window.location.search);
      setSelectedItem(item);
      if (item?.logo) setSelectedFormat(item.logo.formats[0]?.type ?? "png");
    }
    window.addEventListener("popstate", restoreSharedLogo);
    return () => window.removeEventListener("popstate", restoreSharedLogo);
  }, [pluginMode]);

  useEffect(() => setCurrentPage(1), [selectedCategories, query, sortDirection, pageSize, newLogosOnly]);

  const filteredItems = useMemo(() => explorerCatalogItems
    .map((item) => ({ item, score: searchScore(item, query) }))
    .filter(({ item, score }) => {
      const categoryMatches = selectedCategories.length === 0 ||
        selectedCategories.some((category) => item.categories.includes(category));
      const newLogoMatches = !newLogosOnly || getCatalogLogoBadge(item.logo, latestLogoAddedAt) === "new";
      return categoryMatches && newLogoMatches && Number.isFinite(score);
    })
    .sort((a, b) => compareCatalogResults(a, b, sortDirection))
    .map(({ item }) => item), [selectedCategories, query, sortDirection, newLogosOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const visibleItems = filteredItems.slice(pageStart, pageStart + pageSize);
  const pageEnd = pageStart + visibleItems.length;
  const pagerItems = paginationItems(activePage, totalPages);
  const pickerCategories = categoriesExpanded ? draftCategories : selectedCategories;
  const selectedCategoryLabel = pickerCategories.length === 0
    ? "All categories"
    : pickerCategories.length === 1
      ? categoryLabel(pickerCategories[0])
      : `${pickerCategories.length} categories`;

  async function copyLogo(logo: LogoAsset, formatType: LogoFormatType, dimensions?: LogoDimensions) {
    try {
      if (formatType === "svg") {
        if (!logo.svg) throw new Error("SVG is unavailable");
        const svg = dimensions ? svgAtDimensions(logo.svg, dimensions) : logo.svg;
        await copyTextToClipboard(svg, pluginMode);
      } else {
        const blob = await logoBlob(logo, formatType);
        if (!blob || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
          throw new Error("Image clipboard is unavailable");
        }
        const clipboardBlob = blob.type === "image/png"
          ? blob
          : await convertRaster(previewUrl(logo), "png");
        if (!clipboardBlob) throw new Error("Image clipboard conversion failed");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": clipboardBlob })]);
      }
      setToast(`${logo.name} ${formatType.toUpperCase()} copied`);
    } catch {
      setToast(`Unable to copy ${formatType.toUpperCase()}`);
    }
  }

  async function insertLogo(logo: LogoAsset, formatType: LogoFormatType, dimensions: LogoDimensions) {
    if (!pluginMode) {
      setToast("Install the Figma plugin to insert logos");
      return;
    }
    if (formatType === "svg" && logo.svg) {
      if (!pluginBridge?.post({ type: "insert-logo", name: logo.name, svg: logo.svg, ...dimensions })) {
        setToast("Insertion is available inside Figma");
      }
      return;
    }
    try {
      const sourceBlob = await logoBlob(logo, formatType);
      if (!sourceBlob) throw new Error("Asset unavailable");
      const blob = sourceBlob.type === "image/webp"
        ? await convertRaster(previewUrl(logo), "png")
        : sourceBlob;
      if (!blob) throw new Error("Image conversion failed");
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
      const mimeType = blob.type as "image/png" | "image/webp" | "image/jpeg";
      if (!pluginBridge?.post({ type: "insert-image", name: logo.name, mimeType, bytes, ...dimensions })) {
        setToast("Insertion is available inside Figma");
      }
    } catch {
      setToast(`Unable to insert ${formatType.toUpperCase()}`);
    }
  }

  function openDetails(item: CatalogItem) {
    setSelectedFormat(item.logo?.formats[0]?.type ?? "png");
    setSelectedItem(item);
    if (!pluginMode && item.logo) setSharedLogoLocation(item.logo.slug);
  }

  function closeDetails() {
    setSelectedItem(null);
    if (!pluginMode) setSharedLogoLocation(null);
  }

  function toggleCategory(category: InstitutionCategory) {
    const setCategories = categoriesExpanded ? setDraftCategories : setSelectedCategories;
    setCategories((current) => current.includes(category)
      ? current.filter((value) => value !== category)
      : [...current, category]);
  }

  function toggleCategoryPanel() {
    if (categoriesExpanded) {
      setDraftCategories(selectedCategories);
      setCategoriesExpanded(false);
      return;
    }
    setDraftCategories(selectedCategories);
    setCategoriesExpanded(true);
  }

  function applyCategoryFilters() {
    setSelectedCategories(draftCategories);
    setCategoriesExpanded(false);
  }

  function resetCatalog() {
    setQuery("");
    setSelectedCategories([]);
    setDraftCategories([]);
    setNewLogosOnly(false);
    setCategoriesExpanded(false);
    setCurrentPage(1);
    setProjectPanel(null);
    requestAnimationFrame(() => {
      document.getElementById("catalog-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function toggleNewLogos() {
    setNewLogosOnly((active) => {
      if (!active) {
        setQuery("");
        setSelectedCategories([]);
        setDraftCategories([]);
        setCategoriesExpanded(false);
      }
      return !active;
    });
    setCurrentPage(1);
    requestAnimationFrame(() => {
      document.getElementById("catalog-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function goToPage(page: number) {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    if (nextPage === activePage) return;
    setCurrentPage(nextPage);
    requestAnimationFrame(() => {
      document.querySelector(".results-summary")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function completeLogoRequest() {
    setProjectPanel(null);
    setToast("Thanks — your request was received");
  }

  async function convertRaster(source: string, formatType: LogoFormatType): Promise<Blob | null> {
    if (formatType !== "png" && formatType !== "webp" && formatType !== "jpeg") return null;
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    const mimeType = formatType === "jpeg" ? "image/jpeg" : `image/${formatType}`;
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.94));
  }

  async function logoBlob(logo: LogoAsset, formatType: LogoFormatType): Promise<Blob | null> {
    if (formatType === "svg") {
      return logo.svg ? new Blob([logo.svg], { type: "image/svg+xml;charset=utf-8" }) : null;
    }
    const exactAsset = logo.asset_urls[formatType];
    if (exactAsset) return fetch(exactAsset).then((response) => response.blob());
    const preview = previewUrl(logo);
    return preview ? convertRaster(preview, formatType) : null;
  }

  async function downloadLogo(logo: LogoAsset, formatType: LogoFormatType) {
    const format = logo.formats.find((entry) => entry.type === formatType);
    if (!format) return;
    const blob = await logoBlob(logo, formatType);
    if (!blob) {
      setToast(`${formatType.toUpperCase()} is unavailable`);
      return;
    }
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${logo.slug}.${formatType}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    setToast(`${logo.name} ${formatType.toUpperCase()} downloaded`);
  }

  return (
    <main className={`plugin-shell${pluginMode ? " plugin-compact" : ""}`}>
      <SiteHeader
        currentPage="catalog"
        pluginMode={pluginMode}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        onCatalog={resetCatalog}
        onAbout={() => setProjectPanel("about")}
        onChangelog={() => setProjectPanel("changelog")}
        newLogoCount={newlyAddedLogoCount}
        newLogoDate={latestLogoAddedAt}
        newLogoDateLabel={formatDate(latestLogoAddedAt)}
        newLogoNames={newlyAddedLogoItems.map((item) => item.displayName)}
        newLogosActive={newLogosOnly}
        onNewLogos={toggleNewLogos}
      />

      <section className="catalog-intro">
        <span className="frame-register frame-register-top-left" aria-hidden="true" />
        <span className="frame-register frame-register-top-right" aria-hidden="true" />
        <span className="frame-register frame-register-bottom-left" aria-hidden="true" />
        <span className="frame-register frame-register-bottom-right" aria-hidden="true" />
        <p className="eyebrow"><Landmark aria-hidden="true" size={13} strokeWidth={1.75} /> Nigerian Bank Logos</p>
        <h1>Nigerian financial logos, ready to use.</h1>
        <p>Search verified banks, fintechs, insurers, payment providers, and regulators. Download or copy the right format in seconds.</p>
        <div className="catalog-stats" aria-label="Catalog statistics">
          <span><LayoutGrid aria-hidden="true" size={14} strokeWidth={1.75} /><strong>{availableLogoCount.toLocaleString("en-NG")}</strong> logos</span>
          <span><Layers3 aria-hidden="true" size={14} strokeWidth={1.75} /><strong>{availableInstitutionCategories.length}</strong> categories</span>
          <span><FileCode2 aria-hidden="true" size={14} strokeWidth={1.75} /><strong>{availableFormatCount}</strong> formats</span>
        </div>
      </section>

      <section className="catalog-workspace" id="catalog-results">
        <section className="catalog-controls" aria-label="Catalog controls">
        <label className="search-box">
          <span>Search institutions</span>
          <Search className="search-icon" aria-hidden="true" size={18} strokeWidth={1.75} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) setQuery("");
            }}
            placeholder={'Search logos  — try "Sycamore", "Kuda" ...'}
          />
          {query ? (
            <button
              className="search-clear"
              type="button"
              aria-label="Clear search"
              title="Clear search"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setQuery("")}
            >
              <X aria-hidden="true" size={17} strokeWidth={1.75} />
            </button>
          ) : null}
        </label>

        <div className="catalog-toolbar">
          <div className="filter-heading">
            <span><SlidersHorizontal aria-hidden="true" size={15} strokeWidth={1.75} /> Filters</span>
            <button
              type="button"
              disabled={selectedCategories.length === 0 && !newLogosOnly}
              onClick={() => {
                setSelectedCategories([]);
                setDraftCategories([]);
                setNewLogosOnly(false);
              }}
            >
              Clear
            </button>
          </div>
          <button
            className="category-mobile-toggle"
            type="button"
            aria-expanded={categoriesExpanded}
            aria-controls="category-options"
            onClick={toggleCategoryPanel}
          >
            <LayoutGrid aria-hidden="true" size={18} strokeWidth={1.75} />
            <span>{selectedCategoryLabel}</span>
            <small>{pickerCategories.length === 0 ? `${availableInstitutionCategories.length} groups` : `${pickerCategories.length} selected`}</small>
            <ChevronDown aria-hidden="true" size={17} strokeWidth={1.75} />
          </button>
          <div
            className={`category-capsules${categoriesExpanded ? " expanded" : ""}`}
            id="category-options"
            role="group"
            aria-label="Filter by category"
          >
            <button
              className={`category-capsule${pickerCategories.length === 0 ? " selected" : ""}`}
              type="button"
              aria-pressed={pickerCategories.length === 0}
              onClick={() => {
                if (categoriesExpanded) setDraftCategories([]);
                else setSelectedCategories([]);
              }}
            >
              <LayoutGrid aria-hidden="true" size={15} strokeWidth={1.75} />
              <span>All categories</span>
              <small>{explorerCatalogItems.length.toLocaleString("en-NG")}</small>
              <span className="capsule-check">{pickerCategories.length === 0 ? <Check aria-hidden="true" size={13} /> : null}</span>
            </button>
            {availableInstitutionCategories.map((category) => {
              const Icon = categoryIcons[category] ?? RadioTower;
              const selected = pickerCategories.includes(category);
              return (
                <button
                  className={`category-capsule${selected ? " selected" : ""}`}
                  key={category}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleCategory(category)}
                >
                  <Icon aria-hidden="true" size={15} strokeWidth={1.75} />
                  <span>{categoryLabel(category)}</span>
                  <small>{categoryCounts.get(category)}</small>
                  <span className="capsule-check">{selected ? <Check aria-hidden="true" size={13} /> : null}</span>
                </button>
              );
            })}
            <div className="category-apply-row">
              <button type="button" onClick={applyCategoryFilters}>
                <Check aria-hidden="true" size={16} strokeWidth={2} />
                {draftCategories.length === 0
                  ? "Show all categories"
                  : `Apply ${draftCategories.length} ${draftCategories.length === 1 ? "filter" : "filters"}`}
              </button>
            </div>
          </div>
        </div>
        </section>

      <div className="results-summary">
        <span aria-live="polite">{filteredItems.length.toLocaleString("en-NG")} {filteredItems.length === 1 ? "result" : "results"}</span>
        <div className="results-tools">
          <span>{availableLogoCount.toLocaleString("en-NG")} available logos</span>
          <div className="sort-control" role="group" aria-label="Sort institutions alphabetically">
            <button
              className={sortDirection === "asc" ? "active" : ""}
              type="button"
              aria-pressed={sortDirection === "asc"}
              onClick={() => setSortDirection("asc")}
              title="Sort A to Z"
            >
              <ArrowDownAZ aria-hidden="true" size={14} strokeWidth={1.8} />
              <span>A–Z</span>
            </button>
            <button
              className={sortDirection === "desc" ? "active" : ""}
              type="button"
              aria-pressed={sortDirection === "desc"}
              onClick={() => setSortDirection("desc")}
              title="Sort Z to A"
            >
              <ArrowUpAZ aria-hidden="true" size={14} strokeWidth={1.8} />
              <span>Z–A</span>
            </button>
          </div>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <section className="empty-state">
          <span aria-hidden="true">0</span>
          <h2>No matching institution</h2>
          <p>{pluginMode ? "Try another search or category." : "Try another search or request the missing logo."}</p>
          {!pluginMode ? (
            <button className="empty-state-action" type="button" onClick={() => setProjectPanel("request")}>
              <MessageSquarePlus aria-hidden="true" size={15} strokeWidth={1.8} /> Request this logo
            </button>
          ) : null}
        </section>
      ) : (
        <>
          <section className="logo-grid" aria-label="Financial institutions">
            {visibleItems.map((item, index) => {
              const { logo, displayName, categories } = item;
              const logoBadge = getCatalogLogoBadge(logo, latestLogoAddedAt);
              return (
                <button
                  className={`logo-tile${logo ? "" : " logo-pending"}${logoBadge ? ` logo-${logoBadge}` : ""}`}
                  key={item.institution.slug}
                  type="button"
                  onClick={() => openDetails(item)}
                  style={{ animationDelay: `${(index % 12) * 30}ms` }}
                  aria-label={`View ${displayName} details${logoBadge === "new" ? ", newly added logo" : ""}`}
                  title={pluginMode ? displayName : undefined}
                >
                  <span className={`tile-preview${logo && usesDarkLogoPreview(logo.slug) ? " logo-preview-dark" : ""}`}>
                    {logoBadge === "new" ? <span className="new-tag" aria-hidden="true">New</span> : null}
                    {logo ? <img src={previewUrl(logo)} alt="" /> : (
                      <span className="pending-preview" aria-hidden="true">
                        <span className="pending-monogram">{getInstitutionInitials(displayName)}</span>
                        <span>Awaiting verified asset</span>
                      </span>
                    )}
                  </span>
                  <span className="tile-copy">
                    <strong>{displayName}</strong>
                  </span>
                  <span className="tile-meta">
                    <span className={logo ? "" : "pending-badge"}>{logo ? getAvailableFormats(logo) : "Asset pending"}</span>
                    <time dateTime={logo?.added_at ?? item.institution.added_at}>
                      {formatDate(logo?.added_at ?? item.institution.added_at)}
                    </time>
                  </span>
                </button>
              );
            })}
          </section>
          <nav className="catalog-pager" aria-label="Catalog pagination">
            <div className="pager-summary">
              <label className="pager-page-size">
                <span>Show</span>
                <span className="pager-select-control">
                  <select
                    aria-label="Logos per page"
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden="true" size={15} strokeWidth={1.75} />
                </span>
                <span>per page</span>
              </label>
              <span className="pager-separator" aria-hidden="true">·</span>
              <span aria-live="polite">
                {pageStart + 1}–{pageEnd} of {filteredItems.length.toLocaleString("en-NG")}
              </span>
            </div>

            <div className="pager-pages">
              <button
                className="pager-arrow"
                type="button"
                aria-label="Previous page"
                disabled={activePage === 1}
                onClick={() => goToPage(activePage - 1)}
              >
                <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.75} />
              </button>
              {pagerItems.map((item) => item === "start-ellipsis" || item === "end-ellipsis" ? (
                <span className="pager-ellipsis" key={item} aria-hidden="true">…</span>
              ) : (
                <button
                  className={`pager-page${item === activePage ? " active" : ""}`}
                  type="button"
                  key={item}
                  aria-label={`Page ${item}`}
                  aria-current={item === activePage ? "page" : undefined}
                  onClick={() => goToPage(item)}
                >
                  {item}
                </button>
              ))}
              <button
                className="pager-arrow"
                type="button"
                aria-label="Next page"
                disabled={activePage === totalPages}
                onClick={() => goToPage(activePage + 1)}
              >
                <ChevronRight aria-hidden="true" size={18} strokeWidth={1.75} />
              </button>
            </div>
          </nav>
        </>
      )}
      </section>

      <SiteFooter
        pluginMode={pluginMode}
        onAbout={() => setProjectPanel("about")}
        onChangelog={() => setProjectPanel("changelog")}
        onTrademark={() => setProjectPanel("trademarks")}
        onRequest={() => setProjectPanel("request")}
        onContribute={() => setProjectPanel("contribute")}
      />

      {selectedItem ? (
        <DetailSheet
          item={selectedItem}
          selectedFormat={selectedFormat}
          onClose={closeDetails}
          onFormatChange={setSelectedFormat}
          pluginMode={pluginMode}
          onCopy={copyLogo}
          onDownload={downloadLogo}
          onInsert={pluginMode ? insertLogo : undefined}
          onFeedback={setToast}
          onRequest={() => {
            setQuery(selectedItem.displayName);
            closeDetails();
            setProjectPanel("request");
          }}
        />
      ) : null}

      {!pluginMode && projectPanel ? (
        <ProjectInfoSheet
          panel={projectPanel}
          aboutMarkdown={aboutMarkdown}
          initialRequestName={query}
          onClose={() => setProjectPanel(null)}
          onRequestSubmitted={completeLogoRequest}
        />
      ) : null}

      {toast ? <div className="toast" role="status" onAnimationEnd={() => setToast("")}>{toast}</div> : null}
    </main>
  );
}

export function ProjectInfoSheet({
  panel,
  aboutMarkdown,
  initialRequestName,
  onClose,
  onRequestSubmitted
}: {
  panel: ProjectPanel;
  aboutMarkdown: string;
  initialRequestName: string;
  onClose: () => void;
  onRequestSubmitted: () => void;
}) {
  const isAbout = panel === "about";
  const isContributionGuide = panel === "contribute";
  const isChangelog = panel === "changelog";
  const isRequest = panel === "request";
  const title = isAbout
    ? "About awalogo"
    : isContributionGuide
      ? "Submit your company logo"
      : isChangelog
        ? "Changelog"
        : isRequest
          ? "Request a logo"
          : "Trademark policy";
  const description = isAbout
    ? "The story behind Nigeria's open logo library."
    : isContributionGuide
      ? "Send current official artwork for maintainer review."
      : isChangelog
        ? "New assets, features, and catalog improvements."
        : isRequest
          ? "Tell us what logo is missing. No GitHub account needed."
          : "Logo ownership and acceptable use.";

  return (
    <div className="detail-backdrop project-backdrop" onMouseDown={onClose}>
      <aside
        className={`detail-sheet project-sheet${isAbout ? " about-sheet" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="detail-header">
          <div>
            <span className="verified-label">Open source project</span>
            <h2 id="project-sheet-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close" title="Close">×</button>
        </header>

        <div className="project-sheet-content">
          {isAbout ? (
            <AboutContent markdown={aboutMarkdown} />
          ) : isContributionGuide ? (
            <CompanyLogoSubmissionForm onSubmitted={onRequestSubmitted} />
          ) : isRequest ? (
            <LogoRequestForm
              initialName={initialRequestName}
              onSubmitted={onRequestSubmitted}
            />
          ) : isChangelog ? (
            <div className="changelog-list">
              {publishedChangelog.map((release, index) => (
                <article className="changelog-entry" key={release.version}>
                  <header>
                    <div>
                      <div className="changelog-release-meta">
                        <span className="changelog-version">{release.version}</span>
                        <time dateTime={release.date}>{formatDate(release.date)}</time>
                      </div>
                      <h3>{release.title}</h3>
                    </div>
                    {index === 0 ? <span className="changelog-latest">Latest</span> : null}
                  </header>
                  <ul>
                    {release.changes.map((change) => <li key={change}>{change}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          ) : (
            <>
              <p>Code, metadata, and project tooling are MIT licensed. Logo artwork is not included in that licence.</p>
              <p>Each institution retains ownership of its trademarks. Using an asset from this catalog does not grant ownership or permission to imply endorsement, partnership, or affiliation.</p>
              <p>Maintainers may remove artwork when its source cannot be verified, it becomes outdated, or its owner requests removal.</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function AboutContent({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => parseAboutMarkdown(markdown), [markdown]);

  return (
    <div className="about-content">
      {blocks.map((block, index) => block.type === "heading"
        ? <h3 key={`${block.content}-${index}`}>{block.content}</h3>
        : <p key={`${block.content}-${index}`}>{renderAboutInline(block.content)}</p>)}
    </div>
  );
}

function CompanyLogoSubmissionForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [companyName, setCompanyName] = useState("");
  const [officialWebsite, setOfficialWebsite] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [category, setCategory] = useState("Fintech");
  const [submitterRole, setSubmitterRole] = useState("");
  const [logoFormat, setLogoFormat] = useState("SVG");
  const [logoAssetUrl, setLogoAssetUrl] = useState("");
  const [brandGuidelinesUrl, setBrandGuidelinesUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [error, setError] = useState("");

  function isValidUrl(value: string) {
    try {
      return /^https?:$/.test(new URL(value).protocol);
    } catch {
      return false;
    }
  }

  function submitLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (companyName.trim().length < 2) {
      setError("Enter your company name.");
      return;
    }
    if (!isValidUrl(officialWebsite.trim())) {
      setError("Enter your complete official website URL beginning with http:// or https://.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail.trim())) {
      setError("Enter a valid work email address.");
      return;
    }
    if (logoAssetUrl.trim() && !isValidUrl(logoAssetUrl.trim())) {
      setError("Enter a complete logo or brand-kit URL, or leave it blank to attach the file on GitHub.");
      return;
    }
    if (brandGuidelinesUrl.trim() && !isValidUrl(brandGuidelinesUrl.trim())) {
      setError("Enter a complete brand guidelines URL beginning with http:// or https://.");
      return;
    }
    if (!rightsConfirmed) {
      setError("Confirm that you are authorized to submit the company artwork.");
      return;
    }

    setError("");
    const submissionUrl = buildCompanyLogoSubmissionUrl({
      companyName,
      officialWebsite,
      workEmail,
      category,
      submitterRole,
      logoFormat,
      logoAssetUrl,
      brandGuidelinesUrl,
      notes,
      rightsConfirmed
    });
    const link = document.createElement("a");
    link.href = submissionUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    onSubmitted();
  }

  return (
    <form className="logo-request-form" onSubmit={submitLogo} noValidate>
      <label className="request-field">
        <span>Company name <strong aria-hidden="true">*</strong></span>
        <input
          autoFocus
          value={companyName}
          onChange={(event) => {
            setCompanyName(event.target.value);
            setError("");
          }}
          placeholder="e.g. Example Financial Services"
          autoComplete="organization"
        />
      </label>

      <label className="request-field">
        <span>Official website <strong aria-hidden="true">*</strong></span>
        <input
          type="url"
          value={officialWebsite}
          onChange={(event) => {
            setOfficialWebsite(event.target.value);
            setError("");
          }}
          placeholder="https://yourcompany.com"
          autoComplete="url"
        />
      </label>

      <label className="request-field">
        <span>Work email (public) <strong aria-hidden="true">*</strong></span>
        <input
          type="email"
          value={workEmail}
          onChange={(event) => {
            setWorkEmail(event.target.value);
            setError("");
          }}
          placeholder="name@yourcompany.com"
          autoComplete="email"
          aria-describedby="company-email-notice"
          aria-invalid={error.startsWith("Enter a valid work email")}
        />
      </label>

      <div className="request-field-row">
        <label className="request-field">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>Bank</option>
            <option>Fintech</option>
            <option>Insurance</option>
            <option>Investment platform</option>
            <option>Payments</option>
            <option>Remittance</option>
            <option>Other</option>
          </select>
        </label>
        <label className="request-field">
          <span>Your role</span>
          <input
            value={submitterRole}
            onChange={(event) => setSubmitterRole(event.target.value)}
            placeholder="e.g. Brand manager"
            autoComplete="organization-title"
          />
        </label>
      </div>

      <div className="request-field-row">
        <label className="request-field">
          <span>Primary format</span>
          <select value={logoFormat} onChange={(event) => setLogoFormat(event.target.value)}>
            <option>SVG</option>
            <option>PNG</option>
            <option>WebP</option>
            <option>Multiple formats</option>
            <option>Brand kit</option>
          </select>
        </label>
        <label className="request-field">
          <span>Logo or brand-kit URL</span>
          <input
            type="url"
            value={logoAssetUrl}
            onChange={(event) => {
              setLogoAssetUrl(event.target.value);
              setError("");
            }}
            placeholder="https://"
          />
        </label>
      </div>

      <label className="request-field">
        <span>Brand guidelines URL</span>
        <input
          type="url"
          value={brandGuidelinesUrl}
          onChange={(event) => {
            setBrandGuidelinesUrl(event.target.value);
            setError("");
          }}
          placeholder="https://"
        />
      </label>

      <label className="request-field">
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Tell maintainers which logo lockup and color variant should be treated as primary."
          rows={3}
        />
      </label>

      <label className="request-consent">
        <input
          type="checkbox"
          checked={rightsConfirmed}
          onChange={(event) => {
            setRightsConfirmed(event.target.checked);
            setError("");
          }}
        />
        <span>
          <strong>I am authorized to submit this artwork</strong>
          <small>I confirm that this is the company's current official logo and may be reviewed for inclusion in the public catalog.</small>
        </span>
      </label>

      {error ? <p className="request-error" role="alert">{error}</p> : null}

      <div className="request-submit-row">
        <p id="company-email-notice">The work email will appear in the public GitHub issue. Attach the logo there when no public asset URL is available.</p>
        <button className="project-sheet-action" type="submit">
          Continue on GitHub <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
      </div>
    </form>
  );
}

function LogoRequestForm({
  initialName,
  onSubmitted
}: {
  initialName: string;
  onSubmitted: () => void;
}) {
  const [institutionName, setInstitutionName] = useState(initialName.trim());
  const [officialWebsite, setOfficialWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("Finance app");
  const [logoAssetUrl, setLogoAssetUrl] = useState("");
  const [notifyWhenAvailable, setNotifyWhenAvailable] = useState(false);
  const [websiteConfirm, setWebsiteConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedIssue, setSubmittedIssue] = useState<{ number: number; url: string } | null | undefined>();
  const [error, setError] = useState("");

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (institutionName.trim().length < 2) {
      setError("Enter the company or product name.");
      return;
    }
    try {
      const url = new URL(officialWebsite.trim());
      if (!/^https?:$/.test(url.protocol)) throw new Error();
    } catch {
      setError("Enter the company website beginning with http:// or https://.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (logoAssetUrl.trim()) {
      try {
        const url = new URL(logoAssetUrl.trim());
        if (url.protocol !== "https:") throw new Error();
      } catch {
        setError("Paste a complete sharing link beginning with https://, or leave the field blank.");
        return;
      }
    }

    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/logo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: crypto.randomUUID(),
          institutionName,
          officialWebsite,
          email,
          category,
          logoAssetUrl,
          notifyWhenAvailable,
          websiteConfirm
        })
      });
      const result = await response.json().catch(() => null) as {
        error?: string;
        issue?: { number: number; url: string } | null;
      } | null;
      if (!response.ok) {
        throw new Error(result?.error || "We could not send your request. Please try again.");
      }
      setSubmittedIssue(result?.issue ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : "We could not send your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submittedIssue !== undefined) {
    return (
      <div className="request-success" role="status">
        <span className="request-success-icon" aria-hidden="true">
          <Check size={22} strokeWidth={2} />
        </span>
        <div>
          <h3>Thanks, your request is in.</h3>
          <p>We’ll review the logo and use your email only if we need more information.</p>
        </div>
        <div className="request-success-actions">
          {submittedIssue ? (
            <a href={submittedIssue.url} target="_blank" rel="noreferrer">
              View request <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.8} />
            </a>
          ) : null}
          <button className="project-sheet-action" type="button" onClick={onSubmitted}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <form className="logo-request-form" onSubmit={submitRequest} noValidate>
      <label className="request-honeypot" hidden>
        Leave this field empty
        <input
          value={websiteConfirm}
          onChange={(event) => setWebsiteConfirm(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </label>

      <label className="request-field">
        <span>Company or product name <strong aria-hidden="true">*</strong></span>
        <input
          autoFocus
          value={institutionName}
          onChange={(event) => {
            setInstitutionName(event.target.value);
            setError("");
          }}
          placeholder="e.g. PocketApp"
          autoComplete="organization"
          aria-invalid={Boolean(error && institutionName.trim().length < 2)}
        />
      </label>

      <div className="request-field-row">
        <label className="request-field">
          <span>Type of company</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>Bank</option>
            <option>Finance app</option>
            <option>Fintech</option>
            <option>Insurance</option>
            <option>Investment platform</option>
            <option>Payments</option>
            <option>Other</option>
          </select>
        </label>
        <label className="request-field">
          <span>Company website <strong aria-hidden="true">*</strong></span>
          <input
            type="url"
            required
            value={officialWebsite}
            onChange={(event) => {
              setOfficialWebsite(event.target.value);
              setError("");
            }}
            placeholder="https://"
            autoComplete="url"
            aria-invalid={error.startsWith("Enter the company website")}
          />
        </label>
      </div>

      <label className="request-field">
        <span>Your email address <strong aria-hidden="true">*</strong></span>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
          }}
          placeholder="name@example.com"
          autoComplete="email"
          aria-describedby="logo-request-email-privacy"
          aria-invalid={error.startsWith("Enter a valid email")}
        />
        <small id="logo-request-email-privacy">Only awalogo maintainers can see this. We may use it to ask a question about your request.</small>
      </label>

      <label className="request-field">
        <span>Link to the logo file (optional)</span>
        <input
          type="url"
          value={logoAssetUrl}
          onChange={(event) => {
            setLogoAssetUrl(event.target.value);
            setError("");
          }}
          placeholder="https://drive.google.com/..."
          inputMode="url"
          aria-describedby="logo-request-drive-notice"
          aria-invalid={error.startsWith("Paste a complete sharing link")}
        />
        <small id="logo-request-drive-notice">Share an SVG, PNG, or WebP file using Google Drive, Dropbox, or OneDrive, and allow anyone with the link to view it.</small>
      </label>

      <label className="request-consent">
        <input
          type="checkbox"
          checked={notifyWhenAvailable}
          onChange={(event) => setNotifyWhenAvailable(event.target.checked)}
        />
        <span>
          <strong>Notify me when this logo is available</strong>
          <small>We’ll email you when it has been added to awalogo. You can opt out at any time.</small>
        </span>
      </label>

      {error ? <p className="request-error" role="alert">{error}</p> : null}

      <div className="request-submit-row">
        <p>No GitHub account needed. Your request goes directly to the awalogo maintainers.</p>
        <button className="project-sheet-action" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <RefreshCw className="request-loading-icon" aria-hidden="true" size={15} strokeWidth={1.8} />
              Sending…
            </>
          ) : (
            <>
              Send request <Send aria-hidden="true" size={15} strokeWidth={1.8} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function DetailSheet({
  item,
  selectedFormat,
  pluginMode,
  onClose,
  onFormatChange,
  onCopy,
  onDownload,
  onInsert,
  onFeedback,
  onRequest
}: {
  item: CatalogItem;
  selectedFormat: LogoFormatType;
  pluginMode: boolean;
  onClose: () => void;
  onFormatChange: (format: LogoFormatType) => void;
  onCopy: (logo: LogoAsset, format: LogoFormatType, dimensions?: LogoDimensions) => void;
  onDownload: (logo: LogoAsset, format: LogoFormatType) => void;
  onInsert?: (logo: LogoAsset, format: LogoFormatType, dimensions: LogoDimensions) => void;
  onFeedback: (message: string) => void;
  onRequest: () => void;
}) {
  const { logo, displayName, categories } = item;
  const initialSharedAsset = !pluginMode ? new URLSearchParams(window.location.search).get("asset") : null;
  const [selectedVariationId, setSelectedVariationId] = useState(initialSharedAsset ?? "primary");
  const [dimensions, setDimensions] = useState<LogoDimensions>({ width: 512, height: 512 });
  const [aspectRatio, setAspectRatio] = useState(1);
  const [aspectLocked, setAspectLocked] = useState(true);
  const [shareCopied, setShareCopied] = useState(false);
  if (!logo) {
    const institutionSource = item.institution.sources[0]?.url;
    return (
      <div className="detail-backdrop" onMouseDown={onClose}>
        <aside className="detail-sheet" aria-label={`${displayName} details`} onMouseDown={(event) => event.stopPropagation()}>
          <div className="sheet-handle" aria-hidden="true" />
          <header className="detail-header">
            <div>
              <span className="verified-label pending"><span aria-hidden="true" /> Asset pending</span>
              <h2>{displayName}</h2>
              <p>{getCategorySummary(categories)}</p>
            </div>
            <button className="close-button" type="button" onClick={onClose} aria-label="Close details" title="Close">×</button>
          </header>

          <div className="detail-media pending-detail-media">
            <div className="detail-preview pending-detail-preview">
              <span className="pending-monogram large" aria-hidden="true">{getInstitutionInitials(displayName)}</span>
              <span>Awaiting a verified official source</span>
            </div>
          </div>

          <dl className="detail-facts">
            <div>
              <dt>Logo status</dt>
              <dd>Pending verified asset</dd>
            </div>
            <div>
              <dt>Institution added</dt>
              <dd>{formatDate(item.institution.added_at)}</dd>
            </div>
            {institutionSource ? (
              <div className="source-row">
                <dt>Institution source</dt>
                <dd><a href={institutionSource} target="_blank" rel="noreferrer">{getSourceDomain(institutionSource)}</a></dd>
              </div>
            ) : null}
          </dl>

          <div className="detail-actions single">
            <button className="insert-button" type="button" onClick={onRequest}>
              <MessageSquarePlus aria-hidden="true" size={15} strokeWidth={1.8} /> Request verified logo
            </button>
          </div>
        </aside>
      </div>
    );
  }
  const websiteUrl = logo.website;
  type DetailAsset = { id: string; label: string; kind: "current" | "lockup" | "historical"; previewAssetId: string; retiredAt?: string; asset: LogoAsset };
  const primaryAsset: DetailAsset = {
    id: "primary",
    label: "Primary",
    kind: "current",
    previewAssetId: logo.slug,
    asset: logo
  };
  const variationAssets: DetailAsset[] = [
    primaryAsset,
    ...logo.variations.filter((variation) => variation.status !== "old").map((variation) => ({
      id: variation.id,
      label: variation.name,
      kind: "lockup" as const,
      previewAssetId: `${logo.slug}-${variation.id}`,
      asset: {
        name: `${logo.name} ${variation.name}`,
        slug: `${logo.slug}-${variation.id}`,
        formats: variation.formats,
        svg: variation.svg,
        asset_urls: variation.asset_urls
      }
    }))
  ];
  const versionAssets: DetailAsset[] = [
    {
      id: "primary",
      label: "Current",
      kind: "current",
      previewAssetId: logo.slug,
      asset: logo
    },
    ...logo.variations.filter((variation) => variation.status === "old").map((variation) => ({
      id: variation.id,
      label: variation.name,
      kind: "historical" as const,
      previewAssetId: logo.slug,
      retiredAt: variation.archived_at,
      asset: {
        name: `${logo.name} ${variation.name}`,
        slug: `${logo.slug}-${variation.id}`,
        formats: variation.formats,
        svg: variation.svg,
        asset_urls: variation.asset_urls
      }
    }))
  ];
  const allAssets = [...variationAssets, ...versionAssets.slice(1)];
  const activeVariation = allAssets.find((variation) => variation.id === selectedVariationId) ?? primaryAsset;
  const activeLogo = activeVariation.asset;

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled || !image.naturalWidth || !image.naturalHeight) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
      setAspectRatio(ratio);
      setDimensions({
        width: Math.max(1, Math.round(image.naturalWidth * scale)),
        height: Math.max(1, Math.round(image.naturalHeight * scale))
      });
    };
    image.src = previewUrl(activeLogo);
    return () => {
      cancelled = true;
    };
  }, [activeLogo.slug]);

  function updateDimension(axis: keyof LogoDimensions, nextValue: number) {
    const value = Math.min(8192, Math.max(1, Math.round(nextValue || 1)));
    setDimensions((current) => {
      if (!aspectLocked) return { ...current, [axis]: value };
      if (axis === "width") {
        const height = Math.max(1, Math.round(value / aspectRatio));
        return height <= 8192
          ? { width: value, height }
          : { width: Math.max(1, Math.round(8192 * aspectRatio)), height: 8192 };
      }
      const width = Math.max(1, Math.round(value * aspectRatio));
      return width <= 8192
        ? { width, height: value }
        : { width: 8192, height: Math.max(1, Math.round(8192 / aspectRatio)) };
    });
  }

  function toggleAspectLock() {
    setAspectLocked((current) => {
      const next = !current;
      if (next) {
        setDimensions((size) => {
          const height = Math.max(1, Math.round(size.width / aspectRatio));
          return height <= 8192
            ? { width: size.width, height }
            : { width: Math.max(1, Math.round(8192 * aspectRatio)), height: 8192 };
        });
      }
      return next;
    });
  }

  function selectVariation(id: string) {
    const variation = allAssets.find((entry) => entry.id === id);
    if (!variation) return;
    setSelectedVariationId(id);
    if (!variation.asset.formats.some((format) => format.type === selectedFormat)) {
      onFormatChange(variation.asset.formats[0].type);
    }
  }

  async function shareLogo() {
    if (!logo) return;
    const url = buildLogoShareUrl(logo.slug, activeVariation.id);
    try {
      await copyTextToClipboard(url, false);
      setShareCopied(true);
      onFeedback("Logo link copied");
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      setShareCopied(false);
      onFeedback("Unable to copy logo link");
    }
  }

  return (
    <div className="detail-backdrop" onMouseDown={onClose}>
      <aside className="detail-sheet" aria-label={`${displayName} details`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="detail-header">
          <div>
            <span className={`verified-label${logo.status === "verified" ? "" : " community"}`}>
              <span aria-hidden="true" /> {logo.status === "verified" ? "Verified source" : logo.status === "deprecated" ? "Deprecated asset" : "Unverified"}
            </span>
            <h2>{displayName}</h2>
            <p>{getCategorySummary(categories)}</p>
          </div>
          <div className="detail-header-actions">
            {!pluginMode ? (
              <button className="close-button share-button" type="button" onClick={shareLogo} aria-label={shareCopied ? "Logo link copied" : `Share ${displayName} logo`} title={shareCopied ? "Link copied" : "Share logo"}>
                {shareCopied ? <Check aria-hidden="true" size={15} strokeWidth={1.9} /> : <ArrowUpFromLine aria-hidden="true" size={15} strokeWidth={1.8} />}
              </button>
            ) : null}
            <button className="close-button" type="button" onClick={onClose} aria-label="Close details" title="Close">×</button>
          </div>
        </header>

        {versionAssets.length > 1 ? (
          <div className="variation-picker version-picker">
            <span>Logo version</span>
            <div role="group" aria-label="Logo version">
              {versionAssets.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  className={(version.kind === "current" ? activeVariation.kind !== "historical" : activeVariation.id === version.id) ? "active" : ""}
                  onClick={() => selectVariation(version.id)}
                  aria-pressed={version.kind === "current" ? activeVariation.kind !== "historical" : activeVariation.id === version.id}
                >
                  {version.kind === "current" ? "Current" : `${version.label}${version.retiredAt ? ` · ${formatDate(version.retiredAt)}` : ""}`}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {variationAssets.length > 1 && activeVariation.kind !== "historical" ? (
          <div className="variation-picker">
            <span>Variation</span>
            <div role="group" aria-label="Logo variation">
              {variationAssets.map((variation) => (
                <button
                  key={variation.id}
                  type="button"
                  className={activeVariation.id === variation.id ? "active" : ""}
                  onClick={() => selectVariation(variation.id)}
                  aria-pressed={activeVariation.id === variation.id}
                >
                  {variation.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="detail-media">
          <div className="format-picker" aria-label="Download format">
            {activeLogo.formats.map((format) => {
              const FormatIcon = formatIcons[format.type];
              const label = format.type.toUpperCase();
              return (
                <button
                  key={format.type}
                  type="button"
                  className={selectedFormat === format.type ? "active" : ""}
                  onClick={() => onFormatChange(format.type)}
                  aria-label={`Select ${label} format`}
                  aria-pressed={selectedFormat === format.type}
                  title={label}
                >
                  <FormatIcon aria-hidden="true" size={15} strokeWidth={1.8} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <div className={`detail-preview${usesDarkLogoPreview(activeVariation.previewAssetId) ? " logo-preview-dark" : ""}`}>
            <img src={previewUrl(activeLogo)} alt="" />
          </div>
        </div>

        <dl className="detail-facts">
          {!pluginMode ? (
            <>
              {versionAssets.length > 1 ? <div><dt>Logo version</dt><dd>{activeVariation.kind === "historical" ? `Previous · retired ${activeVariation.retiredAt ? formatDate(activeVariation.retiredAt) : "date unavailable"}` : "Current"}</dd></div> : null}
              <div>
                <dt>Available formats</dt>
                <dd>{getAvailableFormats(activeLogo)}</dd>
              </div>
              <div>
                <dt>Added</dt>
                <dd>{formatDate(logo.added_at)}</dd>
              </div>
            </>
          ) : null}
          <div className="source-row">
            <dt>Official website</dt>
            <dd>
              <a href={websiteUrl} target="_blank" rel="noreferrer" title={`Visit ${displayName} website`}>
                {getSourceDomain(websiteUrl)}
              </a>
            </dd>
          </div>
        </dl>

        {pluginMode ? (
          <div className="dimension-control">
            <span className="dimension-title">Insert size</span>
            <label className="dimension-field">
              <span>W</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="8192"
                value={dimensions.width}
                onChange={(event) => updateDimension("width", event.currentTarget.valueAsNumber)}
                aria-label="Logo width in pixels"
              />
              <small>px</small>
            </label>
            <button
              className="aspect-lock"
              type="button"
              onClick={toggleAspectLock}
              aria-label={aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
              aria-pressed={aspectLocked}
              title={aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
            >
              {aspectLocked
                ? <Lock aria-hidden="true" size={14} strokeWidth={1.8} />
                : <LockOpen aria-hidden="true" size={14} strokeWidth={1.8} />}
            </button>
            <label className="dimension-field">
              <span>H</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="8192"
                value={dimensions.height}
                onChange={(event) => updateDimension("height", event.currentTarget.valueAsNumber)}
                aria-label="Logo height in pixels"
              />
              <small>px</small>
            </label>
          </div>
        ) : null}

        <div className={`detail-actions${pluginMode && onInsert ? "" : activeLogo.svg ? " double" : " single"}`}>
          <button className="download-button" type="button" onClick={() => onDownload(activeLogo, selectedFormat)}>
            Download {selectedFormat.toUpperCase()}
          </button>
          {activeLogo.svg || pluginMode ? (
            <>
              <button className="copy-button" type="button" onClick={() => onCopy(activeLogo, selectedFormat, pluginMode ? dimensions : undefined)}>
                <Copy aria-hidden="true" size={15} strokeWidth={1.8} /> Copy {selectedFormat.toUpperCase()}
              </button>
              {pluginMode && onInsert ? (
                <button className="insert-button" type="button" onClick={() => onInsert(activeLogo, selectedFormat, dimensions)}>
                  Insert {activeVariation.kind === "current" ? displayName : activeVariation.kind === "historical" ? `${displayName} previous logo` : activeVariation.label}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
