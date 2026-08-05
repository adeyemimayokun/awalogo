import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowRight,
  Bell,
  BellRing,
  Check,
  GitFork,
  GitPullRequest,
  Globe2,
  Heart,
  MessageSquarePlus,
  Monitor,
  Moon,
  Sun
} from "lucide-react";
import awalogoLogoUrl from "./assets/awalogo-logo.svg";
import figmaMarkUrl from "./assets/figma-mark.svg";
import siteUpdatesJson from "./site-updates.json";

export const FIGMA_PLUGIN_URL = "https://www.figma.com/community/plugin/1661356348996631383";

export type ThemeMode = "system" | "light" | "dark";
export type SitePage = "catalog" | "docs" | "not-found";

type SiteUpdate = {
  id: string;
  title: string;
  summary: string;
  published_at: string;
  action_label: string;
  action_href: string;
  status: "draft" | "published";
};

const latestSiteUpdate = (siteUpdatesJson as SiteUpdate[])
  .filter((update) => update.status === "published")
  .sort((left, right) => right.published_at.localeCompare(left.published_at))[0] ?? null;

function updateDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function FigmaMark({
  size = 18,
  className = ""
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  return (
    <img
      className={`figma-mark${className ? ` ${className}` : ""}`}
      src={figmaMarkUrl}
      alt=""
      aria-hidden="true"
      width={Math.round(size * 2 / 3)}
      height={size}
    />
  );
}

type SiteHeaderProps = {
  currentPage: SitePage;
  pluginMode: boolean;
  themeMode: ThemeMode;
  onThemeModeChange: (theme: ThemeMode) => void;
  onCatalog: () => void;
  onAbout: () => void;
  onChangelog: () => void;
  newLogoCount?: number;
  newLogoDate?: string;
  newLogoDateLabel?: string;
  newLogoNames?: string[];
  newLogosActive?: boolean;
  onNewLogos?: () => void;
};

type SiteFooterProps = {
  pluginMode: boolean;
  onAbout: () => void;
  onChangelog: () => void;
  onTrademark: () => void;
  onRequest: () => void;
  onContribute: () => void;
};

export function SiteHeader({
  currentPage,
  pluginMode,
  themeMode,
  onThemeModeChange,
  onCatalog,
  onAbout,
  onChangelog,
  newLogoCount = 0,
  newLogoDate = "",
  newLogoDateLabel = "",
  newLogoNames = [],
  newLogosActive = false,
  onNewLogos
}: SiteHeaderProps) {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const ActiveThemeIcon = themeMode === "light" ? Sun : themeMode === "dark" ? Moon : Monitor;
  const activeThemeLabel = themeMode === "light" ? "Light" : themeMode === "dark" ? "Dark" : "System";
  const visibleNewLogoNames = newLogoNames.slice(0, 4);
  const remainingNewLogoCount = Math.max(0, newLogoNames.length - visibleNewLogoNames.length);
  const newLogoSummary = `${visibleNewLogoNames.join(", ")}${remainingNewLogoCount > 0 ? `, and ${remainingNewLogoCount} more` : ""}.`;
  const fallbackUpdate = onNewLogos && newLogoCount > 0 ? {
    title: `${newLogoCount} new logos added`,
    summary: newLogoSummary,
    published_at: newLogoDate,
    action_label: newLogosActive ? "Show all logos" : "View new logos"
  } : null;
  const visibleUpdate = latestSiteUpdate ?? fallbackUpdate;

  useEffect(() => {
    if (!themeMenuOpen) return;

    function closeThemeMenu(event: PointerEvent) {
      if (!themeMenuRef.current?.contains(event.target as Node)) setThemeMenuOpen(false);
    }

    function closeThemeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setThemeMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeThemeMenu);
    document.addEventListener("keydown", closeThemeMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeThemeMenu);
      document.removeEventListener("keydown", closeThemeMenuOnEscape);
    };
  }, [themeMenuOpen]);

  useEffect(() => {
    if (!notificationOpen) return;

    function closeNotification(event: PointerEvent) {
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationOpen(false);
    }

    function closeNotificationOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setNotificationOpen(false);
    }

    document.addEventListener("pointerdown", closeNotification);
    document.addEventListener("keydown", closeNotificationOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeNotification);
      document.removeEventListener("keydown", closeNotificationOnEscape);
    };
  }, [notificationOpen]);

  function selectTheme(theme: ThemeMode) {
    onThemeModeChange(theme);
    setThemeMenuOpen(false);
  }

  return (
    <header className="topbar">
      {pluginMode ? (
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><img src={awalogoLogoUrl} alt="" /></span>
          <strong>awalogo</strong>
        </div>
      ) : (
        <a className="brand site-brand-link" href="/" aria-label="awalogo catalog">
          <span className="brand-mark" aria-hidden="true"><img src={awalogoLogoUrl} alt="" /></span>
          <strong>awalogo</strong>
        </a>
      )}

      {!pluginMode ? (
        <nav className="topbar-nav" aria-label="Primary navigation">
          <button type="button" onClick={onCatalog} aria-current={currentPage === "catalog" ? "page" : undefined}>Home</button>
          <a href="/docs" aria-current={currentPage === "docs" ? "page" : undefined}>Docs</a>
          <button type="button" onClick={onAbout} aria-haspopup="dialog">About</button>
          <button type="button" onClick={onChangelog} aria-haspopup="dialog">Changelog</button>
        </nav>
      ) : null}

      <div className="topbar-actions">
        {!pluginMode ? (
          <>
            <a
              className="topbar-icon-link"
              href="https://github.com/adeyemimayokun/awalogo"
              target="_blank"
              rel="noreferrer"
              aria-label="Open the awalogo GitHub repository"
              title="GitHub repository"
            >
              <GitFork aria-hidden="true" size={15} strokeWidth={1.75} />
            </a>
            <a className="topbar-figma" href={FIGMA_PLUGIN_URL} target="_blank" rel="noreferrer" title="Open awalogo in Figma Community">
              <FigmaMark aria-hidden="true" size={17} />
              <span>Figma plugin</span>
            </a>
          </>
        ) : null}
        {!pluginMode && visibleUpdate ? (
          <div className="notification-menu" ref={notificationRef}>
            <button
              className="topbar-icon-button notification-button"
              type="button"
              aria-label={`Open updates: ${visibleUpdate.title}`}
              aria-haspopup="dialog"
              aria-expanded={notificationOpen}
              aria-pressed={newLogosActive}
              title="Website updates"
              onClick={() => {
                setNotificationOpen((open) => !open);
                setThemeMenuOpen(false);
              }}
            >
              {newLogosActive
                ? <BellRing aria-hidden="true" size={15} strokeWidth={1.75} />
                : <Bell aria-hidden="true" size={15} strokeWidth={1.75} />}
              <span className="notification-dot" aria-hidden="true" />
            </button>
            {notificationOpen ? (
              <div className="notification-popover" role="dialog" aria-label="Logo updates">
                <header>
                  <strong>Updates</strong>
                  <span>Latest</span>
                </header>
                <div className="notification-update">
                  <span className="notification-update-icon" aria-hidden="true"><BellRing size={15} strokeWidth={1.75} /></span>
                  <div>
                    <strong>{visibleUpdate.title}</strong>
                    <p>{visibleUpdate.summary}</p>
                    <time dateTime={visibleUpdate.published_at}>{latestSiteUpdate ? updateDateLabel(visibleUpdate.published_at) : newLogoDateLabel}</time>
                  </div>
                </div>
                {latestSiteUpdate ? (
                  <a className="notification-action" href={latestSiteUpdate.action_href} onClick={() => setNotificationOpen(false)}>
                    <span>{latestSiteUpdate.action_label}</span>
                    <ArrowRight aria-hidden="true" size={15} strokeWidth={1.75} />
                  </a>
                ) : (
                  <button
                    className="notification-action"
                    type="button"
                    onClick={() => {
                      onNewLogos?.();
                      setNotificationOpen(false);
                    }}
                  >
                    <span>{fallbackUpdate?.action_label}</span>
                    <ArrowRight aria-hidden="true" size={15} strokeWidth={1.75} />
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="theme-menu" ref={themeMenuRef}>
          <button
            className="theme-menu-trigger"
            type="button"
            aria-label={`Color theme: ${activeThemeLabel}`}
            aria-haspopup="menu"
            aria-expanded={themeMenuOpen}
            title={`${activeThemeLabel} theme`}
            onClick={() => {
              setThemeMenuOpen((open) => !open);
              setNotificationOpen(false);
            }}
          >
            <ActiveThemeIcon aria-hidden="true" size={15} strokeWidth={1.75} />
          </button>
          {themeMenuOpen ? (
            <div className="theme-menu-popover" role="menu" aria-label="Color theme">
              <button className="theme-menu-option" type="button" role="menuitemradio" aria-checked={themeMode === "system"} onClick={() => selectTheme("system")}>
                <Monitor aria-hidden="true" size={15} strokeWidth={1.75} /><span>System</span>{themeMode === "system" ? <Check aria-hidden="true" size={14} /> : null}
              </button>
              <button className="theme-menu-option" type="button" role="menuitemradio" aria-checked={themeMode === "light"} onClick={() => selectTheme("light")}>
                <Sun aria-hidden="true" size={15} strokeWidth={1.75} /><span>Light</span>{themeMode === "light" ? <Check aria-hidden="true" size={14} /> : null}
              </button>
              <button className="theme-menu-option" type="button" role="menuitemradio" aria-checked={themeMode === "dark"} onClick={() => selectTheme("dark")}>
                <Moon aria-hidden="true" size={15} strokeWidth={1.75} /><span>Dark</span>{themeMode === "dark" ? <Check aria-hidden="true" size={14} /> : null}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({
  pluginMode,
  onAbout,
  onChangelog,
  onTrademark,
  onRequest,
  onContribute
}: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <span className="frame-register frame-register-top-left" aria-hidden="true" />
        <span className="frame-register frame-register-top-right" aria-hidden="true" />
        <span className="frame-register frame-register-bottom-left" aria-hidden="true" />
        <span className="frame-register frame-register-bottom-right" aria-hidden="true" />
        <div className="footer-topbar">
          <div className="footer-brand">
            <img className="footer-brand-logo" src={awalogoLogoUrl} alt="" />
            <strong>awalogo</strong>
          </div>
          <nav className="footer-nav" aria-label="Project links">
            <a href="/docs">Docs</a>
            <button type="button" onClick={onAbout} aria-haspopup="dialog">About</button>
            <a href="https://github.com/adeyemimayokun/awalogo" target="_blank" rel="noreferrer">Contribute</a>
            <button type="button" onClick={onChangelog} aria-haspopup="dialog">Changelog</button>
            <button type="button" onClick={onTrademark} aria-haspopup="dialog">Trademark policy</button>
          </nav>
          <div className="footer-cta">
            <a href={FIGMA_PLUGIN_URL} target="_blank" rel="noreferrer" title="Open awalogo in Figma Community">
              <FigmaMark aria-hidden="true" size={17} /> Figma Plugin
            </a>
            <button type="button" onClick={onRequest} aria-haspopup="dialog" title="Request an unavailable logo">
              <MessageSquarePlus aria-hidden="true" size={15} /> Request a logo
            </button>
            <button className="footer-cta-primary" type="button" onClick={onContribute} aria-haspopup="dialog">
              Submit a logo
            </button>
          </div>
        </div>

        <div className="footer-body">
          <section className="footer-intro" aria-labelledby="footer-intro-title">
            <span className="footer-kicker">Open source · Nigeria</span>
            <h2 id="footer-intro-title">Logo infrastructure for Nigeria's financial ecosystem.</h2>
            <p>A community-maintained collection of verified assets for product designers, developers, and design systems.</p>
          </section>

          <div className="footer-details">
            <div className="footer-detail-grid">
              <section>
                <h3>Catalog</h3>
                <p>Banks, fintechs, payment providers, insurers, investment firms, and other Nigerian financial institutions.</p>
              </section>
              <section>
                <h3>Built for</h3>
                <p>Figma workflows, websites, apps, documentation, and reusable design systems.</p>
              </section>
            </div>
            <section className="footer-disclosure">
              <h3>Asset notice</h3>
              <p>Verified assets are reviewed against institution-owned websites, official brand pages, annual reports, or other authoritative sources. Community imports remain marked for review until their provenance is confirmed.</p>
              <p>Code, metadata, and project tooling are available under the MIT License. Logo artwork and company names remain trademarks of their respective owners and are not relicensed by this project.</p>
            </section>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-meta-links">
            <a href="https://github.com/adeyemimayokun/awalogo" target="_blank" rel="noreferrer">
              <GitFork aria-hidden="true" size={15} /> GitHub
            </a>
            {pluginMode ? (
              <>
                <a href="https://awalogo.com" target="_blank" rel="noreferrer" title="Visit awalogo.com">
                  <Globe2 aria-hidden="true" size={15} /> Website
                </a>
                <a href="https://github.com/adeyemimayokun/awalogo/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer" title="Contribute to awalogo">
                  <GitPullRequest aria-hidden="true" size={15} /> Contribute
                </a>
              </>
            ) : null}
            <span>MIT licensed tooling</span>
          </div>
          <div className="footer-copyright">
            {pluginMode ? (
              <span className="plugin-made-in-lagos">Made with <Heart aria-hidden="true" size={12} strokeWidth={1.8} /> in Lagos</span>
            ) : (
              <span>Built for convenience — check each brand&apos;s guidelines before use.</span>
            )}
            <button type="button" aria-label="Back to top" title="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <ArrowUp aria-hidden="true" size={15} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
