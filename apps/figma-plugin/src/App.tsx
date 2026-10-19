import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  FileCode2,
  FileImage,
  Globe2,
  History,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  Lock,
  LockOpen,
  Monitor,
  MessageSquarePlus,
  Moon,
  RefreshCw,
  Search,
  Sun,
  ShoppingBag,
  Trash2,
  Download,
  X,
  type LucideIcon
} from "lucide-react";
import { getCatalogLogoBadge, usesDarkLogoPreview, type LogoFormatType } from "@awalogo/core";
import {
  CATALOG_ORIGIN,
  CATALOG_PATH,
  parseRuntimeCatalog,
  type RuntimeCatalog
} from "@awalogo/catalog-ui/runtime-catalog";
import {
  catalogCategoryOptions,
  catalogItemsFromRuntime,
  categoryLabel,
  displayCategory,
  matchesCategory,
  type CatalogItem
} from "./catalog-data";
import { searchScore } from "./catalog-search";
import { buildCompanyLogoSubmissionUrl, buildLogoRequestUrl } from "./logo-request";
import { isFigmaPlugin, postToFigma, requestFromFigma, subscribeToFigma } from "./figma-bridge";
import type { PluginToUiMessage } from "./messages";
import type { LogoAsset } from "./logo-data";
import { buildLogoReportUrl, pluginShortcut, type CatalogSort } from "./browse-controls";
import { PACK_KEY, readPack, type PackEntry } from "./pack";
import { parseResources } from "./resource-catalog";
import { PluginFooter } from "./PluginFooter";
import { PluginSelect } from "./PluginSelect";
import { usePluginDialog } from "./usePluginDialog";
import awalogoLogoUrl from "../community-assets/awalogo-logo.svg";
import type { PackInsertItem } from "./messages";
import "./styles.css";
import "./v2-style.css";

type ProjectPanel = "changelog" | "contribute" | "request" | "trademarks";
type ThemeMode = "system" | "light" | "dark";
type LogoDimensions = { width: number; height: number };

const PAGE_SIZE = 48;
const THEME_STORAGE_KEY = "nigerian-bank-logos-theme";
const formatIcons: Record<LogoFormatType, LucideIcon> = {
  svg: FileCode2,
  png: FileImage,
  webp: Images,
  jpeg: ImageIcon
};
const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos"
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00+01:00`));
}

function getSourceDomain(sourceUrl: string) {
  return new URL(sourceUrl).hostname.replace(/^www\./, "");
}

function getAvailableFormats(logo: LogoAsset) {
  return logo.formats.map((format) => format.type.toUpperCase()).join(" · ");
}

function getCategorySummary(categories: string[]) {
  return categories.map(categoryLabel).join(" · ");
}

function getInstitutionInitials(name: string) {
  const words = name
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "NG";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

const svgPreviewUrls = new Map<string, string>();

function previewUrl(logo: LogoAsset) {
  if (!logo.svg) return logo.asset_urls.svg ?? logo.asset_urls.webp ?? logo.asset_urls.png ?? logo.asset_urls.jpeg ?? "";
  const cachedUrl = svgPreviewUrls.get(logo.svg);
  if (cachedUrl) return cachedUrl;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo.svg)}`;
  svgPreviewUrls.set(logo.svg, url);
  return url;
}

async function copyTextToClipboard(text: string) {
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

function App() {
  const [runtimeCatalog, setRuntimeCatalog] = useState<RuntimeCatalog | null>(null);
  const [resources, setResources] = useState<CatalogItem[]>([]);
  const [resourceState, setResourceState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [resourceKind, setResourceKind] = useState<"logos" | "flags">("logos");
  const [catalogState, setCatalogState] = useState<"loading" | "fresh" | "cached" | "stale" | "error">("loading");
  const [catalogError, setCatalogError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CatalogSort>("name");
  const searchRef = useRef<HTMLInputElement>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<LogoFormatType>("svg");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [toast, setToast] = useState("");
  const [collection, setCollection] = useState<PackEntry[]>(() => isFigmaPlugin() ? [] : readPack());
  const [packLoaded, setPackLoaded] = useState(() => !isFigmaPlugin());
  const [packStorageReady, setPackStorageReady] = useState(() => !isFigmaPlugin());
  const [bagOpen, setBagOpen] = useState(false);
  const [undoPack, setUndoPack] = useState<PackEntry[] | null>(null);
  const [preparingZip, setPreparingZip] = useState(false);
  const [projectPanel, setProjectPanel] = useState<ProjectPanel | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => themeMode === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : themeMode);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [draftCategories, setDraftCategories] = useState<string[]>([]);
  const [categoryQuery, setCategoryQuery] = useState("");
  const categoryPickerRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const ActiveThemeIcon = resolvedTheme === "light" ? Sun : Moon;
  const activeThemeLabel = themeMode === "light" ? "Light" : themeMode === "dark" ? "Dark" : "System";
  const allCatalogItems = useMemo(() => {
    const legacy = runtimeCatalog ? catalogItemsFromRuntime(runtimeCatalog) : [];
    const identities = new Set(legacy.map((item) => item.logo.slug));
    return [...legacy, ...resources.filter((item) => !identities.has(item.logo.slug))];
  }, [runtimeCatalog, resources]);
  const explorerCatalogItems = useMemo(() => allCatalogItems.filter((item) => (item.kind === "flag") === (resourceKind === "flags")), [allCatalogItems, resourceKind]);
  const browseCategories = useMemo(() => catalogCategoryOptions(explorerCatalogItems), [explorerCatalogItems]);
  const availableInstitutionCategories = useMemo(() => browseCategories.map((entry) => entry.value), [browseCategories]);
  const availableLogoCount = explorerCatalogItems.length;
  usePluginDialog(projectPanel ?? (bagOpen ? "bag" : selectedItem ? `asset:${selectedItem.logo.slug}` : null));
  const categoryCounts = useMemo(() => new Map(browseCategories.map(({ value, count }) => [value, count])), [browseCategories]);
  const latestLogoAddedAt = useMemo(() => explorerCatalogItems.reduce((latest, item) => {
    const addedAt = item.logo.added_at;
    return addedAt > latest ? addedAt : latest;
  }, ""), [explorerCatalogItems]);

  useEffect(() => {
    if (!isFigmaPlugin()) return;
    let cancelled = false;
    void requestFromFigma<Extract<PluginToUiMessage, { type: "pack-result" }>>({ type: "pack-load" }, "pack-result").then((response) => {
      if (!cancelled) { setCollection(response.entries); setPackStorageReady(true); }
    }).catch(() => { if (!cancelled) setToast("Saved bag is unavailable; changes are available for this session only"); }).finally(() => { if (!cancelled) setPackLoaded(true); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!packLoaded || !packStorageReady) return;
    if (isFigmaPlugin()) { postToFigma({ type: "pack-save", entries: collection }); return; }
    try { localStorage.setItem(PACK_KEY, JSON.stringify(collection)); } catch { /* Session collection remains usable. */ }
  }, [collection, packLoaded, packStorageReady]);
  useEffect(() => {
    if (!undoPack) return;
    const timer = window.setTimeout(() => setUndoPack(null), 8000);
    return () => window.clearTimeout(timer);
  }, [undoPack]);

  function pack(logo: LogoAsset, format: LogoFormatType) {
    if (!packLoaded) { setToast("Loading your saved bag"); return; }
    if (preparingZip) return;
    if (collection.some((entry) => entry.slug === logo.slug && entry.format === format)) { setToast("Already packed"); return; }
    if (collection.length >= 50) { setToast("Your bag holds up to 50 assets"); return; }
    setUndoPack(null);
    setCollection((entries) => [...entries, { slug: logo.slug, name: logo.name, format }]);
    setToast(`${logo.name} packed into bag`);
  }
  const packedAssets = useMemo(() => new Map<string, LogoAsset>(allCatalogItems.flatMap(({ logo }) => [
    [logo.slug, logo] as const,
    ...logo.variations.map((variation) => [`${logo.slug}-${variation.id}`, { ...variation, slug: `${logo.slug}-${variation.id}`, name: `${logo.name} ${variation.name}` }] as const)
  ])), [allCatalogItems]);

  async function loadResources() {
    const origin = isFigmaPlugin() ? CATALOG_ORIGIN : window.location.origin;
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      let value: unknown;
      try {
        const response = await fetch(`${origin}/catalog/plugin/v2/index.json`, { signal: controller.signal });
        if (!response.ok) throw new Error("Resource supplement unavailable");
        value = await response.json();
      } finally { window.clearTimeout(timeout); }
      setResources(parseResources(value, origin));
      setResourceState("ready");
      try { localStorage.setItem("awalogo:plugin-resources:v2", JSON.stringify(value)); } catch { /* Keep network resources for this session. */ }
    } catch {
      try {
        const cached = localStorage.getItem("awalogo:plugin-resources:v2");
        if (cached) { setResources(parseResources(JSON.parse(cached), origin)); setResourceState("ready"); return; }
      } catch { /* Never block the legacy catalog for invalid supplement data. */ }
      setResourceState("unavailable");
    }
  }

  async function loadCatalog(force = false) {
    void loadResources();
    setCatalogError("");
    if (!runtimeCatalog) setCatalogState("loading");
    try {
      if (isFigmaPlugin()) {
        const response = await requestFromFigma<Extract<PluginToUiMessage, { type: "catalog-result" }>>(
          { type: "catalog-load", force },
          "catalog-result"
        );
        setRuntimeCatalog(parseRuntimeCatalog(response.catalog));
        setCatalogState(response.stale ? "stale" : response.source === "cache" ? "cached" : "fresh");
      } else {
        const response = await fetch(`${CATALOG_ORIGIN}${CATALOG_PATH}`, { cache: force ? "reload" : "default" });
        if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`);
        setRuntimeCatalog(parseRuntimeCatalog(await response.json()));
        setCatalogState("fresh");
      }
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "The catalog is unavailable.");
      setCatalogState(runtimeCatalog ? "stale" : "error");
    }
  }

  useEffect(() => {
    void loadCatalog();
    // The initial request should run once; refreshes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = themeMode === "system" ? (systemTheme.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = resolvedTheme;
      setResolvedTheme(resolvedTheme);
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
    if (!themeMenuOpen) return;

    function closeThemeMenu(event: PointerEvent) {
      if (!themeMenuRef.current?.contains(event.target as Node)) setThemeMenuOpen(false);
    }

    function closeThemeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setThemeMenuOpen(false);
        themeMenuRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();
      }
    }

    document.addEventListener("pointerdown", closeThemeMenu);
    document.addEventListener("keydown", closeThemeMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeThemeMenu);
      document.removeEventListener("keydown", closeThemeMenuOnEscape);
    };
  }, [themeMenuOpen]);

  useEffect(() => {
    return subscribeToFigma((message) => {
      if (message.type === "catalog-result" || message.type === "asset-result" || message.type === "request-error" || message.type === "pack-result" || message.type === "pack-inserted") return;
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
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (bagOpen) { setBagOpen(false); return; }
        if (selectedItem || projectPanel) { setSelectedItem(null); setProjectPanel(null); searchRef.current?.focus(); return; }
        if (categoryPickerOpen) {
          setCategoryPickerOpen(false);
          setCategoryQuery("");
          categoryPickerRef.current?.querySelector<HTMLButtonElement>(".category-picker-trigger")?.focus();
          return;
        }
        if (themeMenuOpen) return;
        setSelectedItem(null);
        setProjectPanel(null);
        searchRef.current?.focus();
        return;
      }
      const target = event.target as HTMLElement | null;
      const action = pluginShortcut(event, Boolean(target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")));
      if (!action) return;
      if (action === "search" && (selectedItem || projectPanel || bagOpen)) return;
      event.preventDefault();
      if (action === "search" && !selectedItem && !projectPanel) searchRef.current?.focus();
      if (action === "request") { setCategoryPickerOpen(false); setThemeMenuOpen(false); setBagOpen(false); setSelectedItem(null); setProjectPanel("request"); }
      if (action === "bag") { setCategoryPickerOpen(false); setThemeMenuOpen(false); setSelectedItem(null); setProjectPanel(null); setBagOpen((open) => !open); }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [categoryPickerOpen, themeMenuOpen, selectedItem, projectPanel, bagOpen]);

  useEffect(() => {
    if (!categoryPickerOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!categoryPickerRef.current?.contains(event.target as Node)) {
        setCategoryPickerOpen(false);
        setCategoryQuery("");
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [categoryPickerOpen]);

  useEffect(() => setVisibleLimit(PAGE_SIZE), [selectedCategories, query, sort]);

  const filteredItems = useMemo(() => explorerCatalogItems
    .map((item) => ({ item, score: searchScore(item, query) }))
    .filter(({ item, score }) => {
      const categoryMatches = matchesCategory(item.logo.category, selectedCategories);
      return categoryMatches && Number.isFinite(score);
    })
    .sort((a, b) => a.score - b.score || (sort === "newest" ? b.item.logo.added_at.localeCompare(a.item.logo.added_at) : 0) || a.item.displayName.localeCompare(b.item.displayName))
    .map(({ item }) => item), [explorerCatalogItems, selectedCategories, query, sort]);

  const visibleItems = filteredItems.slice(0, visibleLimit);
  const visibleCategories = useMemo(() => {
    const normalizedQuery = categoryQuery.trim().toLocaleLowerCase("en-NG");
    return normalizedQuery
      ? availableInstitutionCategories.filter((category) => categoryLabel(category)
        .toLocaleLowerCase("en-NG")
        .includes(normalizedQuery))
      : availableInstitutionCategories;
  }, [categoryQuery, availableInstitutionCategories]);
  const draftResultCount = useMemo(() => explorerCatalogItems.filter((item) => {
    const categoryMatches = matchesCategory(item.logo.category, draftCategories);
    return categoryMatches && Number.isFinite(searchScore(item, query));
  }).length, [draftCategories, explorerCatalogItems, query]);
  const categorySelectionLabel = selectedCategories.length === 0
    ? (resourceKind === "flags" ? "All regions" : "All categories")
    : selectedCategories.length === 1
      ? categoryLabel(selectedCategories[0])
      : `${selectedCategories.length} selected`;
  const categorySelectionSummary = selectedCategories.length === 0
    ? "Browse every available resource"
    : selectedCategories.map(categoryLabel).join(", ");

  async function convertRaster(source: string, formatType: LogoFormatType): Promise<Blob | null> {
    if (formatType !== "png" && formatType !== "webp" && formatType !== "jpeg") return null;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    const mimeType = formatType === "jpeg" ? "image/jpeg" : `image/${formatType}`;
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.94));
  }

  async function loadAssetBytes(logo: LogoAsset, formatType: LogoFormatType) {
    const format = logo.formats.find((entry) => entry.type === formatType);
    const url = logo.asset_urls[formatType];
    if (!format || !url) throw new Error(`${formatType.toUpperCase()} is unavailable`);

    let bytes: Uint8Array;
    if (isFigmaPlugin()) {
      const response = await requestFromFigma<Extract<PluginToUiMessage, { type: "asset-result" }>>(
        { type: "asset-load", url, checksum: format.checksum },
        "asset-result"
      );
      bytes = new Uint8Array(response.bytes);
    } else {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Asset request failed with ${response.status}`);
      bytes = new Uint8Array(await response.arrayBuffer());
    }

    const exactBuffer = bytes.slice().buffer as ArrayBuffer;
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", exactBuffer)))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    if (digest !== format.checksum) throw new Error("Asset integrity check failed");
    return { bytes, buffer: exactBuffer, format };
  }

  async function logoBlob(logo: LogoAsset, formatType: LogoFormatType): Promise<Blob | null> {
    const exactAsset = logo.formats.find((format) => format.type === formatType);
    if (exactAsset) {
      const { buffer, format } = await loadAssetBytes(logo, formatType);
      return new Blob([buffer], { type: format.mime_type });
    }
    const preview = previewUrl(logo);
    return preview ? convertRaster(preview, formatType) : null;
  }

  async function insertLogo(logo: LogoAsset, formatType: LogoFormatType, dimensions: LogoDimensions) {
    try {
      if (!isFigmaPlugin()) { setToast("Open the plugin in Figma to insert assets"); return; }
      if (formatType === "svg") {
        const { bytes } = await loadAssetBytes(logo, "svg");
        postToFigma({ type: "insert-logo", name: logo.name, svg: new TextDecoder().decode(bytes), ...dimensions });
        return;
      }
      const sourceBlob = await logoBlob(logo, formatType);
      if (!sourceBlob) throw new Error("Asset unavailable");
      const blob = sourceBlob.type === "image/webp"
        ? await convertRaster(previewUrl(logo), "png")
        : sourceBlob;
      if (!blob) throw new Error("Image conversion failed");
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
      const mimeType = blob.type as "image/png" | "image/webp" | "image/jpeg";
      postToFigma({ type: "insert-image", name: logo.name, mimeType, bytes, ...dimensions });
    } catch {
      setToast(`Unable to insert ${formatType.toUpperCase()}`);
    }
  }

  async function copyLogo(logo: LogoAsset, formatType: LogoFormatType, dimensions: LogoDimensions) {
    try {
      if (formatType === "svg") {
        const { bytes } = await loadAssetBytes(logo, "svg");
        await copyTextToClipboard(svgAtDimensions(new TextDecoder().decode(bytes), dimensions));
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

  function openDetails(item: CatalogItem) {
    setSelectedFormat(item.logo?.formats[0]?.type ?? "png");
    setSelectedItem(item);
  }

  function toggleCategory(category: string) {
    const next = draftCategories.includes(category)
      ? draftCategories.filter((value) => value !== category)
      : [...draftCategories, category];
    setDraftCategories(next);
    setSelectedCategories(next);
  }

  function toggleCategoryPicker() {
    if (!categoryPickerOpen) {
      setDraftCategories(selectedCategories);
      setCategoryQuery("");
    }
    setCategoryPickerOpen((current) => !current);
  }

  function applyCategoryFilter() {
    setSelectedCategories(draftCategories);
    setCategoryPickerOpen(false);
    setCategoryQuery("");
    categoryPickerRef.current?.querySelector<HTMLButtonElement>(".category-picker-trigger")?.focus();
  }

  function resetCatalog() {
    setQuery("");
    setSelectedCategories([]);
    setDraftCategories([]);
    setSort("name");
    setVisibleLimit(PAGE_SIZE);
    setProjectPanel(null);
    requestAnimationFrame(() => {
      document.getElementById("catalog-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function completeLogoRequest() {
    setProjectPanel(null);
    setToast("Submission prepared on GitHub");
  }

  function chooseTheme(mode: ThemeMode) {
    setThemeMode(mode);
    setThemeMenuOpen(false);
    themeMenuRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();
  }

  async function downloadLogo(logo: LogoAsset, formatType: LogoFormatType) {
    const format = logo.formats.find((entry) => entry.type === formatType);
    if (!format) return;
    let blob: Blob | null = null;
    try {
      blob = await logoBlob(logo, formatType);
    } catch {
      setToast(`${formatType.toUpperCase()} is unavailable`);
      return;
    }
    if (!blob) return;
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

  async function insertPack() {
    if (preparingZip || !collection.length) return;
    if (!isFigmaPlugin()) { setToast("Open the plugin in Figma to insert all assets"); return; }
    setPreparingZip(true);
    setUndoPack(null);
    try {
      const items: PackInsertItem[] = [];
      let total = 0;
      for (const entry of collection) {
        const asset = packedAssets.get(entry.slug);
        if (!asset) throw new Error(`${entry.name} is not in the current catalog`);
        const format = entry.format ?? asset.formats[0].type;
        const source = await logoBlob(asset, format);
        if (!source) throw new Error(`${entry.name} is unavailable`);
        const blob = source.type === "image/webp" ? await convertRaster(previewUrl(asset), "png") : source;
        if (!blob) throw new Error(`${entry.name} could not be converted`);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        total += bytes.byteLength;
        if (total > 100_000_000) throw new Error("Bag exceeds 100 MB");
        const dimensions = { width: 200, height: 140 };
        if (format === "svg") items.push({ type: "insert-logo", name: entry.name, svg: new TextDecoder().decode(bytes), ...dimensions });
        else {
          const bitmap = await createImageBitmap(blob);
          dimensions.width = bitmap.width;
          dimensions.height = bitmap.height;
          bitmap.close();
          items.push({ type: "insert-image", name: entry.name, mimeType: blob.type as "image/png" | "image/jpeg", bytes: Array.from(bytes), ...dimensions });
        }
      }
      await requestFromFigma({ type: "insert-pack", items }, "pack-inserted", 60_000);
      setToast(`${items.length} assets inserted`);
    } catch (error) { setToast(error instanceof Error ? error.message : "Bag could not be inserted"); }
    finally { setPreparingZip(false); }
  }

  if (catalogState === "loading" && !runtimeCatalog) {
    return (
      <main className="plugin-shell catalog-connection-state" aria-live="polite">
        <RefreshCw className="catalog-loading-icon" aria-hidden="true" size={22} />
        <h1>Loading the latest logos</h1>
        <p>Connecting to awalogo.com.</p>
      </main>
    );
  }

  if (catalogState === "error" && !runtimeCatalog && !resources.length && resourceState !== "loading") {
    return (
      <main className="plugin-shell catalog-connection-state" role="alert">
        <Globe2 aria-hidden="true" size={22} />
        <h1>Catalog unavailable</h1>
        <p>{catalogError || "Connect to the internet and try again."}</p>
        <button type="button" onClick={() => void loadCatalog(true)}><RefreshCw size={14} /> Try again</button>
      </main>
    );
  }

  return (
    <main className="plugin-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><img src={awalogoLogoUrl} alt="" /></span>
          <div>
            <strong>awalogo</strong>
            <small>Brand assets & flags</small>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="plugin-bag-trigger" type="button" onClick={() => { setBagOpen((open) => !open); setSelectedItem(null); setProjectPanel(null); }} title="Download bag (Alt+B)" aria-label={`Download bag, ${collection.length} items`} aria-keyshortcuts="Alt+B" aria-expanded={bagOpen}>
            <ShoppingBag aria-hidden="true" size={16} /><span>{collection.length}</span>
          </button>
          <button className="plugin-request-primary" type="button" onClick={() => setProjectPanel("request")} title="Request logo (Alt+R)" aria-keyshortcuts="Alt+R">
            <MessageSquarePlus aria-hidden="true" size={15} /> Request logo
          </button>
          <button
            className={`catalog-sync-status ${catalogState}`}
            type="button"
            onClick={() => void loadCatalog(true)}
            title={catalogState === "stale" ? "Offline; showing the last saved catalog" : "Refresh catalog"}
          >
            <RefreshCw aria-hidden="true" size={12} />
            {catalogState === "fresh" ? "Live" : catalogState === "cached" ? "Cached" : catalogState === "stale" ? "Offline" : "Syncing"}
          </button>
          <div className="theme-menu" role="group" aria-label="Color theme" ref={themeMenuRef}>
            <button className="theme-menu-trigger" type="button" aria-label="Switch color theme" title="Switch light / dark theme" onClick={() => setThemeMode(document.documentElement.dataset.theme === "dark" ? "light" : "dark")}>
              <ActiveThemeIcon aria-hidden="true" size={14} />
            </button>
            <button
              className="theme-menu-trigger"
              type="button"
              aria-label={`Color theme: ${activeThemeLabel}`}
              aria-haspopup="menu"
              aria-expanded={themeMenuOpen}
              title={`${activeThemeLabel} theme`}
              onClick={() => setThemeMenuOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                event.preventDefault();
                setThemeMenuOpen(true);
                const last = event.key === "ArrowUp";
                requestAnimationFrame(() => {
                  const options = themeMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
                  (last ? options?.[options.length - 1] : options?.[0])?.focus();
                });
              }}
            >
              <ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} />
            </button>
            {themeMenuOpen ? (
              <div className="theme-menu-popover" role="menu" aria-label="Color theme" onKeyDown={(event) => {
                if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
                const index = options.indexOf(document.activeElement as HTMLButtonElement);
                const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
                options[next]?.focus();
              }}>
                <button className="theme-menu-option" type="button" role="menuitemradio" aria-checked={themeMode === "system"} onClick={() => chooseTheme("system")}>
                  <Monitor aria-hidden="true" size={14} strokeWidth={1.75} /><span>System</span>{themeMode === "system" ? <Check aria-hidden="true" size={13} /> : null}
                </button>
                <button className="theme-menu-option" type="button" role="menuitemradio" aria-checked={themeMode === "light"} onClick={() => chooseTheme("light")}>
                  <Sun aria-hidden="true" size={14} strokeWidth={1.75} /><span>Light</span>{themeMode === "light" ? <Check aria-hidden="true" size={13} /> : null}
                </button>
                <button className="theme-menu-option" type="button" role="menuitemradio" aria-checked={themeMode === "dark"} onClick={() => chooseTheme("dark")}>
                  <Moon aria-hidden="true" size={14} strokeWidth={1.75} /><span>Dark</span>{themeMode === "dark" ? <Check aria-hidden="true" size={13} /> : null}
                </button>
              </div>
            ) : null}
          </div>
          <span className="asset-count" title={`${availableLogoCount.toLocaleString("en-NG")} available logos`}>
            {availableLogoCount.toLocaleString("en-NG")}
          </span>
        </div>
      </header>

      <section className="catalog-intro">
        <p className="eyebrow">Resource library</p>
        <h1>Find the right mark.</h1>
        <p>Browse Nigerian and African brands, financial institutions, and country flags.</p>
      </section>

      <div className="plugin-resource-tabs" role="group" aria-label="Resource type">
        {(["logos", "flags"] as const).map((kind) => <button type="button" key={kind} aria-pressed={resourceKind === kind} onClick={() => { setResourceKind(kind); setSelectedCategories([]); setDraftCategories([]); setCategoryPickerOpen(false); setCategoryQuery(""); setQuery(""); setVisibleLimit(PAGE_SIZE); }}>{kind === "logos" ? "Logos" : "Flags"}</button>)}
        {resourceState === "unavailable" ? <span role="status">Additional resources are unavailable. <button type="button" onClick={() => void loadResources()}>Retry</button></span> : null}
      </div>

      <section className="catalog-controls" aria-label="Catalog controls">
        <label className="search-box">
          <span>Search assets</span>
          <Search className="search-icon" aria-hidden="true" size={18} strokeWidth={1.75} />
          <input
            ref={searchRef}
            aria-keyshortcuts="/"
            title="Search assets (/)"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) { event.stopPropagation(); setQuery(""); }
            }}
            placeholder={resourceKind === "flags" ? "Search country or code…" : "Search brands or aliases…"}
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

        <div className="catalog-toolbar" ref={categoryPickerRef}>
          <div className={`category-picker${categoryPickerOpen ? " open" : ""}`} onClick={(event) => { if (event.target === event.currentTarget) { setCategoryPickerOpen(false); setCategoryQuery(""); } }}>
            <button
              className="category-picker-trigger"
              type="button"
              aria-expanded={categoryPickerOpen}
              aria-controls="category-picker-panel"
              aria-haspopup="dialog"
              aria-label={resourceKind === "flags" ? "Filter by regions" : "Filter by categories"}
              onClick={toggleCategoryPicker}
            >
              <span className="category-picker-icon" aria-hidden="true">
                <LayoutGrid size={18} strokeWidth={1.75} />
              </span>
              <span className="category-picker-copy">
                <strong>{categorySelectionLabel}</strong>
                <small title={categorySelectionSummary}>{categorySelectionSummary}</small>
              </span>
              <span className="category-picker-result-count">
                {filteredItems.length.toLocaleString("en-NG")}
              </span>
              <ChevronDown className="category-picker-chevron" aria-hidden="true" size={17} strokeWidth={1.75} />
            </button>

            {categoryPickerOpen ? (
              <div className="category-picker-panel" id="category-picker-panel" role="dialog" aria-label={resourceKind === "flags" ? "Choose regions" : "Choose categories"}>
                <header className="category-picker-header">
                  <div>
                    <strong>{resourceKind === "flags" ? "Regions" : "Categories"}</strong>
                    <small>Select one or more</small>
                  </div>
                  <div className="category-picker-header-actions">
                    <span>{draftCategories.length === 0 ? "All" : `${draftCategories.length} selected`}</span>
                    <button
                      type="button"
                      aria-label="Close category picker"
                      onClick={() => {
                        setCategoryPickerOpen(false);
                        setCategoryQuery("");
                      }}
                    >
                      <X aria-hidden="true" size={15} strokeWidth={1.75} />
                    </button>
                  </div>
                </header>

                <label className="category-search">
                  <Search aria-hidden="true" size={15} strokeWidth={1.75} />
                  <span>{resourceKind === "flags" ? "Search regions" : "Search categories"}</span>
                  <input
                    autoFocus
                    value={categoryQuery}
                    onChange={(event) => setCategoryQuery(event.target.value)}
                    placeholder={resourceKind === "flags" ? "Find a region" : "Find a category"}
                  />
                  {categoryQuery ? (
                    <button type="button" aria-label="Clear category search" onClick={() => setCategoryQuery("")}>
                      <X aria-hidden="true" size={14} strokeWidth={1.75} />
                    </button>
                  ) : null}
                </label>

                <div className="category-options" role="group" aria-label={resourceKind === "flags" ? "Available regions" : "Available categories"}>
                  {categoryQuery === "" ? (
                    <button
                      className={`category-option all-categories${draftCategories.length === 0 ? " selected" : ""}`}
                      type="button"
                      aria-pressed={draftCategories.length === 0}
                      onClick={() => { setDraftCategories([]); setSelectedCategories([]); }}
                    >
                      <LayoutGrid aria-hidden="true" size={16} strokeWidth={1.75} />
                      <span>{resourceKind === "flags" ? "All regions" : "All categories"}</span>
                      <small>{explorerCatalogItems.length.toLocaleString("en-NG")}</small>
                      <span className="category-option-check" aria-hidden="true">
                        {draftCategories.length === 0 ? <Check size={14} strokeWidth={2} /> : null}
                      </span>
                    </button>
                  ) : null}

                  {visibleCategories.map((category) => {
                    const selected = draftCategories.includes(category);
                    const label = categoryLabel(category);
                    return (
                      <label
                        className={`category-option${selected ? " selected" : ""}`}
                        key={category}
                        title={label}
                      >
                        <input type="checkbox" checked={selected} onChange={() => toggleCategory(category)} />
                        <span>{label}</span>
                        <small>{categoryCounts.get(category)}</small>
                      </label>
                    );
                  })}

                  {visibleCategories.length === 0 ? (
                    <p className="category-no-results">{resourceKind === "flags" ? "No matching region" : "No matching category"}</p>
                  ) : null}
                </div>

                <footer className="category-picker-actions">
                  <button
                    className="category-clear-button"
                    type="button"
                    disabled={draftCategories.length === 0}
                    onClick={() => { setDraftCategories([]); setSelectedCategories([]); }}
                  >
                    Clear
                  </button>
                  <button className="category-apply-button" type="button" onClick={applyCategoryFilter}>
                    Done · {draftResultCount.toLocaleString("en-NG")} {draftResultCount === 1 ? "result" : "results"}
                  </button>
                </footer>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {selectedCategories.length ? <div className="plugin-filter-chips" aria-label={resourceKind === "flags" ? "Selected regions" : "Selected categories"}>
        {selectedCategories.map((category) => <button key={category} type="button" aria-label={`Remove ${categoryLabel(category)} filter`} onClick={() => toggleCategory(category)}><span>{categoryLabel(category)}</span><X size={13} aria-hidden="true" /></button>)}
      </div> : null}

      <div className="results-summary" id="catalog-results" aria-live="polite">
        <span>{filteredItems.length.toLocaleString("en-NG")} {filteredItems.length === 1 ? "result" : "results"}</span>
        <div className="plugin-result-actions">
          {query || selectedCategories.length || sort !== "name" ? <button type="button" onClick={resetCatalog}><RefreshCw aria-hidden="true" size={13} /> Reset filters</button> : null}
          <PluginSelect aria-label="Sort resources" value={sort} onChange={(event) => setSort(event.target.value as CatalogSort)}>
            <option value="name">Name A–Z</option>
            <option value="newest">Recently added</option>
          </PluginSelect>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <section className="empty-state">
          <span aria-hidden="true">0</span>
          <h2>{resourceKind === "flags" ? "No matching flag" : "No matching brand"}</h2>
          <p>Try another search or request the missing logo.</p>
          <button className="empty-state-action" type="button" onClick={() => setProjectPanel("request")}>
            <MessageSquarePlus aria-hidden="true" size={15} strokeWidth={1.8} /> Request this logo
          </button>
        </section>
      ) : (
        <>
          <section className="logo-grid" aria-label={resourceKind === "flags" ? "Country flags" : "Brand logos"}>
            {visibleItems.map((item, index) => {
              const { logo, displayName } = item;
              const logoBadge = getCatalogLogoBadge(logo, latestLogoAddedAt);
              return (
                <button
                  className={`logo-tile${logo ? "" : " logo-pending"}${logoBadge ? ` logo-${logoBadge}` : ""}`}
                  key={logo.slug}
                  type="button"
                  onClick={() => openDetails(item)}
                  style={{ animationDelay: `${(index % 12) * 30}ms` }}
                  aria-label={`View ${displayName} details${logoBadge === "new" ? ", newly added logo" : ""}`}
                >
                  <span className={`tile-preview${logo && (logo.preview_background === "dark" || usesDarkLogoPreview(logo.slug)) ? " logo-preview-dark" : ""}`}>
                    {logoBadge === "new" ? <span className="new-tag" aria-hidden="true">New</span> : null}
                    {logo ? <img src={previewUrl(logo)} alt="" loading="lazy" /> : (
                      <span className="pending-preview" aria-hidden="true">
                        <span className="pending-monogram">{getInstitutionInitials(displayName)}</span>
                        <span>Awaiting verified asset</span>
                      </span>
                    )}
                  </span>
                  <span className="tile-copy">
                    <strong>{displayName}</strong>
                    <small>{displayCategory(item)}</small>
                  </span>
                  <span className="tile-meta">
                    <span className={logo ? "" : "pending-badge"}>{logo ? getAvailableFormats(logo) : "Asset pending"}</span>
                    <time dateTime={logo.added_at}>
                      {formatDate(logo.added_at)}
                    </time>
                  </span>
                </button>
              );
            })}
          </section>
          {visibleItems.length < filteredItems.length ? (
            <div className="load-more-row">
              <button type="button" onClick={() => setVisibleLimit((limit) => limit + PAGE_SIZE)}>
                Show more <span>{visibleItems.length} / {filteredItems.length.toLocaleString("en-NG")}</span>
              </button>
            </div>
          ) : null}
        </>
      )}

      <PluginFooter onPanelChange={setProjectPanel} />

      {selectedItem ? (
        <DetailSheet
          key={selectedItem.logo.slug}
          initialVariationId={selectedItem.logo.variations.find((entry) => entry.status === "old" && query.trim() && entry.name.toLowerCase().replace(/[^a-z0-9]/g, "") === query.toLowerCase().replace(/[^a-z0-9]/g, ""))?.id}
          item={selectedItem}
          selectedFormat={selectedFormat}
          onClose={() => setSelectedItem(null)}
          onFormatChange={setSelectedFormat}
          onCopy={copyLogo}
          onInsert={insertLogo}
          onDownload={downloadLogo}
          onPack={pack}
          onRequest={() => {
            setQuery(selectedItem.displayName);
            setSelectedItem(null);
            setProjectPanel("request");
          }}
        />
      ) : null}

      {bagOpen ? <div className="detail-backdrop" onMouseDown={() => setBagOpen(false)}>
        <aside className="detail-sheet plugin-pack-sheet" role="dialog" aria-modal="true" aria-label="Download bag" onMouseDown={(event) => event.stopPropagation()}>
          <header className="detail-header"><h2>Download bag <small>{collection.length}</small></h2><button className="close-button" type="button" aria-label="Close bag" onClick={() => setBagOpen(false)}><X size={16} /></button></header>
          {collection.length ? <button className="plugin-drop-all" type="button" disabled={preparingZip} onClick={() => { setUndoPack(collection); setCollection([]); }}>Drop all</button> : <p>Your bag is empty.</p>}
          {collection.map((entry) => {
            const asset = packedAssets.get(entry.slug);
            return <div className="plugin-pack-row" key={`${entry.slug}:${entry.format}`}>
              <div><strong>{entry.name}</strong><small>{asset ? (entry.format ?? asset.formats[0].type).toUpperCase() : "Not in the current catalog"}</small></div>
              {asset ? <button type="button" title={`Download ${entry.name}`} aria-label={`Download ${entry.name}`} onClick={() => void downloadLogo(asset, entry.format ?? asset.formats[0].type)}><Download size={16} /></button> : null}
              <button type="button" disabled={preparingZip} title="Drop item" aria-label={`Drop ${entry.name}`} onClick={() => { setUndoPack(null); setCollection((entries) => entries.filter((value) => value.slug !== entry.slug || value.format !== entry.format)); }}><Trash2 size={16} /></button>
            </div>;
          })}
          {undoPack ? <div className="plugin-pack-undo" role="status">Items dropped. <button type="button" onClick={() => { setCollection(undoPack); setUndoPack(null); }}>Undo</button></div> : null}
          {collection.length ? <button className="plugin-request-primary" type="button" disabled={preparingZip} onClick={() => void insertPack()}><LayoutGrid size={15} aria-hidden="true" />{preparingZip ? "Inserting…" : "Insert all"}</button> : null}
        </aside>
      </div> : null}

      {projectPanel ? (
        <ProjectInfoSheet
          panel={projectPanel}
          initialRequestName={query}
          onClose={() => setProjectPanel(null)}
          onRequestSubmitted={completeLogoRequest}
        />
      ) : null}

      {toast ? <div className="toast" role="status" onAnimationEnd={() => setToast("")}>{toast}</div> : null}
    </main>
  );
}

function ProjectInfoSheet({
  panel,
  initialRequestName,
  onClose,
  onRequestSubmitted
}: {
  panel: ProjectPanel;
  initialRequestName: string;
  onClose: () => void;
  onRequestSubmitted: () => void;
}) {
  const isContributionGuide = panel === "contribute";
  const isChangelog = panel === "changelog";
  const isRequest = panel === "request";
  const title = isContributionGuide
    ? "Submit your company logo"
    : isChangelog
      ? "Changelog"
      : isRequest
        ? "Request a logo"
        : "Trademark policy";
  const description = isContributionGuide
    ? "Send current official artwork for maintainer review."
    : isChangelog
      ? "New assets, features, and catalog improvements."
      : isRequest
        ? "Tell us which financial brand is missing."
      : "Logo ownership and acceptable use.";

  return (
    <div className="detail-backdrop project-backdrop" onMouseDown={onClose}>
      <aside
        className="detail-sheet project-sheet"
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
          {isContributionGuide ? (
            <CompanyLogoSubmissionForm onSubmitted={onRequestSubmitted} />
          ) : isRequest ? (
            <LogoRequestForm
              initialName={initialRequestName}
              onSubmitted={onRequestSubmitted}
            />
          ) : isChangelog ? (
            <div className="changelog-list">
              <article className="changelog-entry">
                <header>
                  <div>
                    <time dateTime="2026-07-14">14 July 2026</time>
                    <h3>Catalog expansion</h3>
                  </div>
                  <span>Latest</span>
                </header>
                <ul>
                  <li>Added unavailable-logo requests with optional GitHub issue notifications.</li>
                  <li>Audited all 202 Nigeria Logos entries and added 41 financial assets as clearly marked community sources.</li>
                  <li>Added PocketApp, InvestNaija, i-invest, GetEquity, Wahed, and Hisa from official product sources.</li>
                  <li>Added AB Microfinance Bank and backfilled institution-to-logo links across the regulator exports.</li>
                  <li>Expanded the regulated directory with a categorized community fintech research list, keeping unverified candidates clearly separated and using explicit pending states where verified artwork is unavailable.</li>
                  <li>Added PNG and WebP downloads alongside available SVG files.</li>
                  <li>Merged duplicate institution brands under familiar display names.</li>
                  <li>Added relevance-ranked search and multi-category filtering.</li>
                  <li>Added official website links, theme controls, and floating project panels.</li>
                </ul>
              </article>
              <article className="changelog-entry">
                <header>
                  <div>
                    <time dateTime="2026-07-13">13 July 2026</time>
                    <h3>Initial release</h3>
                  </div>
                </header>
                <ul>
                  <li>Launched the searchable Nigerian financial institution logo catalog.</li>
                  <li>Added verified source metadata and logo detail previews.</li>
                  <li>Introduced editable SVG insertion for the Figma plugin.</li>
                  <li>Added catalog validation and an open source contribution workflow.</li>
                </ul>
              </article>
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

function CompanyLogoSubmissionForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [companyName, setCompanyName] = useState("");
  const [officialWebsite, setOfficialWebsite] = useState("");
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

      <div className="request-field-row">
        <label className="request-field">
          <span>Category</span>
          <PluginSelect aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>Bank</option>
            <option>Fintech</option>
            <option>Insurance</option>
            <option>Investment platform</option>
            <option>Payments</option>
            <option>Remittance</option>
            <option>Other</option>
          </PluginSelect>
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
          <PluginSelect aria-label="Primary format" value={logoFormat} onChange={(event) => setLogoFormat(event.target.value)}>
            <option>SVG</option>
            <option>PNG</option>
            <option>WebP</option>
            <option>Multiple formats</option>
            <option>Brand kit</option>
          </PluginSelect>
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
        <p>GitHub opens with these details prefilled. Attach the logo file there before submitting when no public asset URL is available.</p>
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
  const [category, setCategory] = useState("Finance app");
  const [notes, setNotes] = useState("");
  const [notificationConsent, setNotificationConsent] = useState(false);
  const [error, setError] = useState("");

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (institutionName.trim().length < 2) {
      setError("Enter the institution or product name.");
      return;
    }
    if (officialWebsite.trim()) {
      try {
        const url = new URL(officialWebsite.trim());
        if (!/^https?:$/.test(url.protocol)) throw new Error();
      } catch {
        setError("Enter a complete website URL beginning with http:// or https://.");
        return;
      }
    }

    setError("");
    const requestUrl = buildLogoRequestUrl({
      institutionName,
      officialWebsite,
      category,
      notes,
      notificationConsent
    });
    const link = document.createElement("a");
    link.href = requestUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    onSubmitted();
  }

  return (
    <form className="logo-request-form" onSubmit={submitRequest} noValidate>
      <label className="request-field">
        <span>Institution or product name <strong aria-hidden="true">*</strong></span>
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
          <span>Category</span>
          <PluginSelect aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>Bank</option>
            <option>Finance app</option>
            <option>Fintech</option>
            <option>Insurance</option>
            <option>Investment platform</option>
            <option>Payments</option>
            <option>Other</option>
          </PluginSelect>
        </label>
        <label className="request-field">
          <span>Official website</span>
          <input
            type="url"
            value={officialWebsite}
            onChange={(event) => {
              setOfficialWebsite(event.target.value);
              setError("");
            }}
            placeholder="https://"
            autoComplete="url"
            aria-invalid={Boolean(error && officialWebsite.trim())}
          />
        </label>
      </div>

      <label className="request-field">
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Where can maintainers find the current brand artwork?"
          rows={3}
        />
      </label>

      <label className="request-consent">
        <input
          type="checkbox"
          checked={notificationConsent}
          onChange={(event) => setNotificationConsent(event.target.checked)}
        />
        <span>
          <strong>Notify me when it is added</strong>
          <small>I consent to updates through the GitHub issue. GitHub controls delivery, and I can unsubscribe at any time.</small>
        </span>
      </label>

      {error ? <p className="request-error" role="alert">{error}</p> : null}

      <div className="request-submit-row">
        <p>No email address is collected. You will review the request before submitting it on GitHub.</p>
        <button className="project-sheet-action" type="submit">
          Continue on GitHub <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
      </div>
    </form>
  );
}

function DetailSheet({
  item,
  initialVariationId,
  selectedFormat,
  onClose,
  onFormatChange,
  onCopy,
  onInsert,
  onDownload,
  onPack,
  onRequest
}: {
  item: CatalogItem;
  initialVariationId?: string;
  selectedFormat: LogoFormatType;
  onClose: () => void;
  onFormatChange: (format: LogoFormatType) => void;
  onCopy: (logo: LogoAsset, format: LogoFormatType, dimensions: LogoDimensions) => void;
  onInsert: (logo: LogoAsset, format: LogoFormatType, dimensions: LogoDimensions) => void;
  onDownload: (logo: LogoAsset, format: LogoFormatType) => void;
  onPack: (logo: LogoAsset, format: LogoFormatType) => void;
  onRequest: () => void;
}) {
  const { logo, displayName, categories } = item;
  const [selectedVariationId, setSelectedVariationId] = useState(initialVariationId ?? "primary");
  const [dimensions, setDimensions] = useState<LogoDimensions>({ width: 512, height: 512 });
  const [aspectRatio, setAspectRatio] = useState(1);
  const [aspectLocked, setAspectLocked] = useState(true);
  if (!logo) {
    const institutionSource = item.institution?.sources[0]?.url;
    return (
      <div className="detail-backdrop" onMouseDown={onClose}>
        <aside className="detail-sheet" role="dialog" aria-modal="true" aria-label={`${displayName} details`} onMouseDown={(event) => event.stopPropagation()}>
          <div className="sheet-handle" aria-hidden="true" />
          <header className="detail-header">
            <div>
              <span className="verified-label pending"><span aria-hidden="true" /> Asset pending</span>
              <h2>{displayName}</h2>
              <p>{displayCategory(item)}</p>
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
              <dd>{item.institution ? formatDate(item.institution.added_at) : "Not available"}</dd>
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
    label: item.kind === "flag" ? "4:3 rectangular" : "Primary",
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
  const artworkSource = logo.variations.find((entry) => entry.id === activeVariation.id)?.source_url ?? logo.source_url;

  useEffect(() => {
    let cancelled = false;
    const intrinsic = activeLogo.formats.find((format) => format.width && format.height);
    if (intrinsic?.width && intrinsic.height) {
      const scale = Math.min(1, 1024 / Math.max(intrinsic.width, intrinsic.height));
      setAspectRatio(intrinsic.width / intrinsic.height);
      setDimensions({ width: Math.max(1, Math.round(intrinsic.width * scale)), height: Math.max(1, Math.round(intrinsic.height * scale)) });
      return;
    }
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
        setDimensions((size) => ({
          width: size.width,
          height: Math.min(8192, Math.max(1, Math.round(size.width / aspectRatio)))
        }));
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

  return (
    <div className="detail-backdrop" onMouseDown={onClose}>
      <aside className="detail-sheet" role="dialog" aria-modal="true" aria-label={`${displayName} details`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="detail-header">
          <div>
            <span className={`verified-label${logo.status === "verified" ? "" : " community"}`}>
              <span aria-hidden="true" /> {item.kind === "flag" ? "Flag-icons · MIT" : activeVariation.kind === "historical" ? "Historical artwork · review source" : logo.status === "verified" ? "Verified source" : logo.status === "deprecated" ? "Deprecated asset" : "Unverified"}
            </span>
            <h2>{displayName}</h2>
            <p>{displayCategory(item)}</p>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close details" title="Close">×</button>
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
          <div className={`detail-preview${logo.preview_background === "dark" || usesDarkLogoPreview(activeVariation.previewAssetId) ? " logo-preview-dark" : ""}`}>
            <img src={previewUrl(activeLogo)} alt="" />
          </div>
        </div>

        <dl className="detail-facts">
          {item.institutions.length > 0 && categories.length > 1 ? <div className="source-row"><dt>Institution classifications</dt><dd>{getCategorySummary(categories)}</dd></div> : null}
          {versionAssets.length > 1 ? <div><dt>Logo version</dt><dd>{activeVariation.kind === "historical" ? `Previous · retired ${activeVariation.retiredAt ? formatDate(activeVariation.retiredAt) : "date unavailable"}` : "Current"}</dd></div> : null}
          <div>
            <dt>Available formats</dt>
            <dd>{getAvailableFormats(activeLogo)}</dd>
          </div>
          <div>
            <dt>Added</dt>
            <dd>{formatDate(logo.added_at)}</dd>
          </div>
          <div className="source-row">
            <dt>{item.kind === "flag" ? "Artwork library" : "Official website"}</dt>
            <dd>
              <a href={websiteUrl} target="_blank" rel="noreferrer" title={`Visit ${displayName} website`}>
                {getSourceDomain(websiteUrl)}
              </a>
            </dd>
          </div>
          <div className="source-row"><dt>Artwork source</dt><dd><a href={artworkSource} target="_blank" rel="noreferrer">{getSourceDomain(artworkSource)}</a></dd></div>
        </dl>

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

        <div className="detail-actions plugin-actions">
          <button className="copy-button" type="button" onClick={() => onCopy(activeLogo, selectedFormat, dimensions)}>
            <Copy aria-hidden="true" size={15} strokeWidth={1.8} /> Copy {selectedFormat.toUpperCase()}
          </button>
          <button className="insert-button" type="button" onClick={() => onInsert(activeLogo, selectedFormat, dimensions)}>
            Insert {activeVariation.kind === "current" ? displayName : activeVariation.kind === "historical" ? `${displayName} previous logo` : activeVariation.label}
          </button>
        </div>
        <div className="plugin-secondary-actions">
          <button type="button" onClick={() => onPack(activeLogo, selectedFormat)}><ShoppingBag size={15} aria-hidden="true" /> Pack into bag</button>
          <button type="button" onClick={() => onDownload(activeLogo, selectedFormat)}><Download size={15} aria-hidden="true" /> Download {selectedFormat.toUpperCase()}</button>
        </div>
        <section className="plugin-report">
          <strong>Found an issue?</strong>
          <a href={buildLogoReportUrl(displayName, activeLogo.slug, artworkSource)} target="_blank" rel="noreferrer">{item.kind === "flag" ? "Report flag" : "Report logo"} <ArrowUpRight aria-hidden="true" size={14} /></a>
        </section>
      </aside>
    </div>
  );
}

const rootElement = document.getElementById("root")!;
const root = import.meta.hot?.data.root ?? createRoot(rootElement);
if (import.meta.hot) import.meta.hot.data.root = root;

root.render(<App />);
