import { useLayoutEffect, useState } from "react";
import {
  BookOpen,
  Check,
  Copy,
  FileCode2,
  GitPullRequest,
  Landmark,
  PackageOpen,
  ShieldCheck
} from "lucide-react";
import { ProjectInfoSheet, type ProjectPanel } from "./CatalogApp";
import { FIGMA_PLUGIN_URL, SiteFooter, SiteHeader, type ThemeMode } from "./SiteChrome";
import "./styles.css";

const THEME_STORAGE_KEY = "awalogo-theme";
const GITHUB_URL = "https://github.com/adeyemimayokun/awalogo";

const sections = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "website", label: "Using the website", icon: Landmark },
  { id: "v2", label: "V2 preview", icon: BookOpen },
  { id: "developer", label: "Developer setup", icon: PackageOpen },
  { id: "contributing", label: "Contributing", icon: GitPullRequest },
  { id: "verification", label: "Verification and use", icon: ShieldCheck }
] as const;

function getInitialTheme(): ThemeMode {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") return storedTheme;
  } catch {
    // Keep the system theme when browser storage is unavailable.
  }
  return "system";
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="docs-code-block">
      <div className="docs-code-header">
        <span>{label}</span>
        <button type="button" onClick={copyCode} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
          {copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

export function DocsApp({ aboutMarkdown = "" }: { aboutMarkdown?: string }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const [projectPanel, setProjectPanel] = useState<ProjectPanel | null>(null);

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
      // Keep the selected theme for this session when persistence is unavailable.
    }

    document.title = "Docs | awalogo";
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = "Documentation for awalogo: V1 financial logos, the V2 Nigerian and African brand/flag preview, and contribution workflows.";

    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [themeMode]);

  return (
    <main className="plugin-shell docs-shell">
      <SiteHeader
        currentPage="docs"
        pluginMode={false}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        onCatalog={() => { window.location.href = "/"; }}
        onAbout={() => setProjectPanel("about")}
        onChangelog={() => setProjectPanel("changelog")}
      />

      <header className="docs-hero">
        <span className="frame-register frame-register-top-left" aria-hidden="true" />
        <span className="frame-register frame-register-top-right" aria-hidden="true" />
        <span className="frame-register frame-register-bottom-left" aria-hidden="true" />
        <span className="frame-register frame-register-bottom-right" aria-hidden="true" />
        <p className="eyebrow"><FileCode2 aria-hidden="true" size={13} strokeWidth={1.75} /> Documentation</p>
        <h1>Build with awalogo.</h1>
        <p>Use reviewed brand resources on the web and financial logos inside Figma. Explore the V1 catalog, the separate V2 company/flag preview, and safe contribution workflows.</p>
        <nav className="docs-jump-links" aria-label="Documentation sections">
          {sections.slice(1, 4).map(({ id, label }) => <a key={id} href={`#${id}`}>{label}</a>)}
        </nav>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar">
          <div>
            <span className="docs-sidebar-label">On this page</span>
            <nav aria-label="Documentation table of contents">
              {sections.map(({ id, label, icon: Icon }) => (
                <a key={id} href={`#${id}`}>
                  <Icon aria-hidden="true" size={15} strokeWidth={1.65} />
                  <span>{label}</span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <article className="docs-content">
          <section id="overview" className="docs-section">
            <h2>Overview</h2>
            <p>awalogo began with an open source catalog of Nigerian banks, fintechs, payment providers, insurers, investment firms, regulators, and related financial institutions. V1 and the current plugin retain that catalog; the <a href="#v2">V2 preview</a> adds independently reviewed companies across industries and country flags.</p>
            <p>Each accepted record connects recognizable brand metadata to reviewed SVG or raster assets. The website provides the public browsing and download experience.</p>
            <div className="docs-note">
              <strong>Distribution status</strong>
              <p>The website and <a href={FIGMA_PLUGIN_URL} target="_blank" rel="noreferrer">Figma Community plugin</a> are available now. The public npm release is still pending, while <code>@awalogo/core</code> can be built from this repository today.</p>
            </div>
          </section>

          <section id="website" className="docs-section">
            <h2>Using the website</h2>
            <ol className="docs-steps">
              <li><strong>Search</strong><span>Find an institution by its public name, legal name, abbreviation, or known alias.</span></li>
              <li><strong>Filter</strong><span>Select one or more financial categories, then choose alphabetical order when needed.</span></li>
              <li><strong>Inspect</strong><span>Open a logo to review its source status, available variations, formats, and official website.</span></li>
              <li><strong>Use</strong><span>Download SVG, PNG, or WebP. SVG can also be copied directly when a verified vector source is available.</span></li>
            </ol>
            <div className="docs-format-grid" aria-label="Available logo formats">
              <div><strong>SVG</strong><p>Best for editable vectors, interfaces, and design systems.</p></div>
              <div><strong>PNG</strong><p>Best for documents and tools that need broad raster support.</p></div>
              <div><strong>WebP</strong><p>Best for compact web delivery when vector artwork is unnecessary.</p></div>
            </div>
          </section>

          <section id="v2" className="docs-section">
            <h2>V2 preview: companies and flags</h2>
            <p><a href="/v2">V2</a> remains Coming soon. It adds reviewed Nigerian companies across industries, African companies and <a href="/v2/flags">country/territory flags</a> without replacing V1 artwork. The current Figma plugin still uses the original catalog; these additions are web-only.</p>
            <p>Unfiltered logo and flag lists show 20 items per page. Pagination includes up to three previous and two next page numbers, plus first/last jumps. Searches and filtered results remain unpaginated. Logo filters support multiple categories, industry and operating market; flags use regions and country names/codes.</p>
            <p>Separate search suggestions use similar names and explicitly sourced corporate affiliations. Flag suggestions use names only. Former names are searchable; searching 9mobile opens its community-sourced historical artwork under T2 rather than replacing the current logo.</p>
            <p>The draggable floating download bag supports Pack into bag, Drop item and Drop all. Bulk drop offers an eight-second Undo; later changes dismiss that snapshot. Mixed logo/flag ZIPs retain the 50-item/100 MB limits and include source metadata and the flag artwork license. Preparation locks collection changes.</p>
            <p>Asset panels expose available formats, versions, code copying and share links. Logo reporting stays at the end of the panel; flags do not use that endpoint. Source verification is not trademark permission, and reviewed community artwork is not officially verified.</p>
            <p>V2 supports light/dark themes and English, Hausa, Yoruba, Igbo and Nigerian Pidgin. Translations await fluent review. Action sounds are enabled after interaction unless muted in More options; page load, typing, hover and dragging remain silent.</p>
            <p>Keyboard shortcuts: <kbd>/</kbd> focuses the current collection search, <kbd>Alt+B</kbd> toggles the bag, <kbd>Alt+R</kbd> opens logo requests, and <kbd>Escape</kbd> closes the active layer. Global shortcuts ignore typing and composition. Focused bag arrow keys move it; Home restores its position.</p>
            <p>Flags use pinned MIT-licensed flag-icons artwork in standardized 4:3 and square variants, not guaranteed official national proportions. Brand colors, PDF guidelines, owner publishing, SEO/prerendering and V2 plugin support remain planned. Preview implementation does not imply production launch or completed browser/audio/mobile checks.</p>
            <a href={`${GITHUB_URL}/blob/main/docs/v2-guide.md`} target="_blank" rel="noreferrer">Read the detailed V2 guide</a>
          </section>

          <section id="developer" className="docs-section">
            <h2>Developer setup</h2>
            <p>Clone the monorepo to use the current typed catalog, run the website, or work on asset tooling.</p>
            <CodeBlock
              label="Terminal"
              code={`git clone ${GITHUB_URL}.git\ncd awalogo\npnpm install\npnpm dev:web`}
            />
            <h3>Read catalog metadata</h3>
            <p>The core package exports the validated catalog, typed helpers, schemas, format types, and institution links.</p>
            <CodeBlock
              label="TypeScript"
              code={`import { findLogoBySlug, getLogosByCategory } from "@awalogo/core";\n\nconst access = findLogoBySlug("access-bank");\nconst commercialBanks = getLogosByCategory("commercial-bank");\n\nconsole.log(access?.formats);\nconsole.log(commercialBanks.length);`}
            />
            <h3>Catalog record</h3>
            <CodeBlock
              label="TypeScript"
              code={`type LogoEntry = {\n  name: string;\n  slug: string;\n  category: LogoCategory;\n  aliases: string[];\n  website: string;\n  source_url: string;\n  source_type: SourceType;\n  formats: LogoFormat[];\n  variations?: LogoVariation[];\n  status: "verified" | "needs-review" | "deprecated";\n};`}
            />
          </section>

          <section id="contributing" className="docs-section">
            <h2>Contributing</h2>
            <p>Contributions should improve accuracy, provenance, coverage, or tooling. Officially verified logos require an official source and should never be recreated by tracing a raster image. New V2 companies use the separate packages/brands review workflow; explicitly reviewed community artwork keeps a non-official status. Do not rewrite existing financial records to add other industries.</p>
            <h3>Add or update a logo</h3>
            <ol className="docs-steps docs-steps-compact">
              <li><strong>Add the source</strong><span>Place official artwork under <code>packages/logos/src</code> and keep the filename aligned with its slug.</span></li>
              <li><strong>Update metadata</strong><span>Record formats, aliases, website, source URL, source type, status, and dates.</span></li>
              <li><strong>Generate formats</strong><span>Run the format pipeline, then inspect each generated derivative.</span></li>
              <li><strong>Validate</strong><span>Run the repository checks before opening a pull request.</span></li>
            </ol>
            <CodeBlock
              label="Validation"
              code={`pnpm logos:formats\npnpm validate\npnpm logos:check-formats\npnpm typecheck\npnpm test`}
            />
            <a className="docs-primary-link" href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">
              <GitPullRequest aria-hidden="true" size={16} /> Read CONTRIBUTING.md
            </a>
          </section>

          <section id="verification" className="docs-section">
            <h2>Verification and acceptable use</h2>
            <div className="docs-definition-list">
              <div><dt>Verified</dt><dd>Artwork has a current institution-owned source such as an official website, media kit, annual report, or regulatory PDF.</dd></div>
              <div><dt>Needs review</dt><dd>Artwork is not officially verified. V2 can publish manually reviewed community artwork with explicit provenance, including historical versions; unresolved/unapproved candidates remain unpublished.</dd></div>
              <div><dt>Raster only</dt><dd>Official PNG, WebP, or JPEG artwork may be accepted when no official vector is published. It is never traced to manufacture an SVG.</dd></div>
            </div>
            <h3>Trademark notice</h3>
            <p>Code, metadata, and tooling are available under the MIT License. Logo artwork and company names remain trademarks of their respective owners and are not relicensed by awalogo.</p>
            <p>Downloading an asset does not grant permission to imply affiliation, partnership, or endorsement. Check each institution's current brand guidelines before use.</p>
            <p>Flag artwork has a separate upstream MIT license, included with mixed ZIPs. Standardized flag dimensions do not establish official national proportions. Community review does not turn company artwork into an MIT-licensed or officially verified asset.</p>
          </section>
        </article>
      </div>

      <SiteFooter
        pluginMode={false}
        onAbout={() => setProjectPanel("about")}
        onChangelog={() => setProjectPanel("changelog")}
        onTrademark={() => setProjectPanel("trademarks")}
        onRequest={() => setProjectPanel("request")}
        onContribute={() => setProjectPanel("contribute")}
      />

      {projectPanel ? (
        <ProjectInfoSheet
          panel={projectPanel}
          aboutMarkdown={aboutMarkdown}
          initialRequestName=""
          onClose={() => setProjectPanel(null)}
          onRequestSubmitted={() => setProjectPanel(null)}
        />
      ) : null}
    </main>
  );
}
