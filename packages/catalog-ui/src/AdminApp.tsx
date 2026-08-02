import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowDownToLine,
  Bell,
  Check,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  FileCode2,
  FileImage,
  GitFork,
  ImagePlus,
  LoaderCircle,
  LogOut,
  MailCheck,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
  Trash2,
  Upload,
  X
} from "lucide-react";
import type { InstitutionCategory } from "@awalogo/institutions";
import awalogoLogoUrl from "./assets/awalogo-logo.svg";
import { availableInstitutionCategories, categoryLabel } from "./catalog-data";
import { logos as bundledLogos } from "./logo-data";
import "./admin.css";

type Session = { login: string; avatarUrl: string; local?: boolean; repositoryAccess?: boolean };
type Format = { type: string; path: string };
type Variation = { id: string; name: string; source_url?: string; svg_path: string | null; formats: Format[]; preview_url?: string };
type VariationDraft = { key: string; id: string; name: string; sourceUrl: string; file: File | null };
type Logo = {
  name: string;
  slug: string;
  category: string;
  categories?: string[];
  website: string;
  source_url: string;
  svg_path: string | null;
  formats: Format[];
  status: string;
  preview_url?: string;
};
type CatalogResponse = { catalog: Logo[]; variations: Record<string, Variation[]>; lockedSlugs: string[]; localPreview?: boolean };
type MutationResult = { pullRequest?: { number: number; url: string }; localPreview?: boolean };
type IntegrationState = { available: boolean; message?: string };
type AdminMode = "requests" | "manage" | "add" | "notifications";
type LogoRequestStatus = "pending" | "in-review" | "needs-info" | "approved" | "completed" | "rejected";
type LogoRequest = {
  number: number;
  institution: string;
  category: string;
  website: string | null;
  email: string | null;
  assetUrl: string | null;
  notifyWhenAvailable: boolean;
  status: LogoRequestStatus;
  state: "open" | "closed";
  submittedAt: string;
  updatedAt: string;
  submitter: string;
  issueUrl: string;
};
type AdminNotification = {
  id: string;
  title: string;
  type: string;
  reason: string;
  unread: boolean;
  updatedAt: string;
  url: string;
};

const sourceTypes = [
  ["official-brand-page", "Official brand page"],
  ["official-website", "Official website"],
  ["annual-report", "Annual report"],
  ["verified-pdf", "Verified PDF"],
  ["other-official", "Other official source"]
] as const;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("The admin API is not available on this development server");
  }
  const body = await response.json() as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the SVG file"));
    reader.readAsDataURL(file);
  });
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function logoCategorySummary(logo: Logo): string {
  return logo.categories?.length
    ? logo.categories.map((category) => categoryLabel(category as InstitutionCategory)).join(" · ")
    : logo.category.replaceAll("-", " ");
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function logoPreview(slug: string, localPreview?: string): string | null {
  const logo = bundledLogos.find((item) => item.slug === slug);
  return logo?.svg ? svgDataUrl(logo.svg) : logo?.asset_urls.png ?? logo?.asset_urls.webp ?? localPreview ?? null;
}

function variationPreview(slug: string, variationId: string, localPreview?: string): string | null {
  const variation = bundledLogos.find((item) => item.slug === slug)?.variations.find((item) => item.id === variationId);
  return variation?.svg ? svgDataUrl(variation.svg) : variation?.asset_urls.png ?? variation?.asset_urls.webp ?? localPreview ?? null;
}

function formatAssetUrl(slug: string, format: Format, variationId?: string, local = false): string | null {
  if (local) return `/api/admin/local-asset?path=${encodeURIComponent(`packages/logos/src/${format.path}`)}`;
  const logo = bundledLogos.find((item) => item.slug === slug);
  const asset = variationId ? logo?.variations.find((item) => item.id === variationId) : logo;
  if (!asset) return null;
  return format.type === "svg" && asset.svg
    ? svgDataUrl(asset.svg)
    : asset.asset_urls[format.type as keyof typeof asset.asset_urls] ?? null;
}

function FormatFiles({ formats, slug, variationId, local = false }: {
  formats: Format[];
  slug: string;
  variationId?: string;
  local?: boolean;
}) {
  return (
    <ul className="admin-format-files" aria-label="Asset files">
      {formats.map((format) => {
        const type = format.type.toUpperCase();
        const url = formatAssetUrl(slug, format, variationId, local);
        const FileIcon = format.type === "svg" ? FileCode2 : FileImage;
        return (
          <li key={`${format.type}-${format.path}`}>
            <span className={`admin-format-icon${format.type === "svg" ? " vector" : ""}`}><FileIcon size={16} /></span>
            <span className="admin-format-name"><strong>{type}</strong><small>{format.path.split("/").pop()}</small></span>
            <span className="admin-format-kind">{format.type === "svg" ? "Vector" : "Raster"}</span>
            {url ? (
              <a href={url} download={format.path.split("/").pop()} aria-label={`Download ${type}`} title={`Download ${type}`}><ArrowDownToLine size={16} /></a>
            ) : <span className="admin-format-unavailable">Unavailable</span>}
          </li>
        );
      })}
    </ul>
  );
}

function UploadField({ file, onFile }: { file: File | null; onFile: (file: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label className={`admin-upload${preview ? " has-file" : ""}`}>
      <input
        type="file"
        accept="image/svg+xml,.svg"
        required
        onChange={(event) => {
          const next = event.target.files?.[0] ?? null;
          if (next && next.size > 1_000_000) {
            setFileError("SVG must be smaller than 1 MB");
            onFile(null);
            event.target.value = "";
            return;
          }
          if (next && !next.name.toLowerCase().endsWith(".svg")) {
            setFileError("Only SVG files are accepted");
            onFile(null);
            event.target.value = "";
            return;
          }
          setFileError("");
          onFile(next);
        }}
      />
      {preview ? <img src={preview} alt="Selected logo preview" /> : <Upload aria-hidden="true" size={22} />}
      <span>{file ? file.name : "Choose SVG"}</span>
      <small className={fileError ? "upload-error" : ""}>{fileError || (file ? `${Math.ceil(file.size / 1024)} KB` : "SVG, maximum 1 MB")}</small>
    </label>
  );
}

function AdminLoadingState() {
  return (
    <main className="admin-loading" aria-label="Loading admin workspace">
      <header>
        <span className="admin-skeleton brand" />
        <span className="admin-skeleton account" />
      </header>
      <div>
        <aside>
          <span className="admin-skeleton search" />
          {Array.from({ length: 7 }, (_, index) => <span className="admin-skeleton row" key={index} />)}
        </aside>
        <section>
          <span className="admin-skeleton title" />
          <span className="admin-skeleton preview" />
        </section>
      </div>
    </main>
  );
}

function keepFocusInDialog(event: KeyboardEvent, dialog: HTMLElement): void {
  if (event.key !== "Tab") return;
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function AdminApp() {
  const [auth, setAuth] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [mode, setMode] = useState<AdminMode>("manage");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MutationResult | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "awalogo Admin | Nigerian Bank Logos";
    return () => { document.title = previousTitle; };
  }, []);

  async function loadCatalog() {
    const next = await api<CatalogResponse>("/api/admin/catalog");
    if (!Array.isArray(next.catalog) || !next.variations) throw new Error("The catalog API returned an invalid response");
    setData(next);
    setSelectedSlug((current) => current || next.catalog[0]?.slug || "");
  }

  useEffect(() => {
    api<{ user: Session }>("/api/auth/session")
      .then(async ({ user }) => {
        setSession(user);
        setAuth("signed-in");
        await Promise.all([
          loadCatalog(),
          api<{ notifications: AdminNotification[] }>("/api/admin/notifications")
            .then(({ notifications }) => setUnreadNotifications(notifications.filter((item) => item.unread).length))
            .catch(() => undefined)
        ]);
      })
      .catch(() => setAuth("signed-out"));
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return (data?.catalog ?? []).filter((logo) => !normalized || `${logo.name} ${logo.slug}`.toLowerCase().includes(normalized));
  }, [data, query]);
  const selected = (data?.catalog ?? []).find((logo) => logo.slug === selectedSlug) ?? null;
  const selectedVariations = selected ? data?.variations[selected.slug] ?? [] : [];

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const next = await api<MutationResult>("/api/admin/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setResult(next);
      await loadCatalog();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  if (auth === "loading") {
    return <AdminLoadingState />;
  }

  if (auth === "signed-out") {
    const reason = new URLSearchParams(window.location.search).get("error");
    return (
      <main className="admin-login">
        <a className="admin-back" href="/"><ArrowLeft size={16} /> Back to library</a>
        <section>
          <div className="admin-login-mark"><ShieldCheck size={25} /></div>
          <p className="admin-kicker">Restricted workspace</p>
          <h1>Logo catalog admin</h1>
          <p>Sign in with an approved maintainer account.</p>
          {reason ? <div className="admin-alert error">This GitHub account is not authorized.</div> : null}
          <a className="admin-github-button" href="/api/auth/github"><GitFork size={18} /> Continue with GitHub</a>
        </section>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-header-primary">
            <a className="admin-brand" href="/">
              <span className="admin-brand-mark"><img src={awalogoLogoUrl} alt="awalogo" /></span>
              <div><strong>Logo Admin</strong><small>Repository CMS</small></div>
            </a>
            <div className="admin-account">
              <img src={session?.avatarUrl} alt="" />
              <span>{session?.local ? "Local sandbox" : `@${session?.login}`}</span>
              <button type="button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
            </div>
          </div>
          <div className="admin-header-secondary">
            <nav className="admin-tabs" aria-label="Admin sections">
              <button aria-current={mode === "requests" ? "page" : undefined} className={mode === "requests" ? "active" : ""} onClick={() => setMode("requests")}><ClipboardList size={18} /> Requests</button>
              <button aria-current={mode === "manage" ? "page" : undefined} className={mode === "manage" ? "active" : ""} onClick={() => setMode("manage")}><FileCode2 size={18} /> Manage logos</button>
              <button aria-current={mode === "add" ? "page" : undefined} className={mode === "add" ? "active" : ""} onClick={() => setMode("add")}><Plus size={18} /> Add logo</button>
              <button aria-current={mode === "notifications" ? "page" : undefined} className={mode === "notifications" ? "active" : ""} onClick={() => setMode("notifications")}><Bell size={18} /> Notifications{unreadNotifications ? <span className="admin-nav-count">{unreadNotifications}</span> : null}</button>
            </nav>
            <span className="admin-managed-count">{data?.catalog.length ?? 0} managed entries</span>
          </div>
        </div>
      </header>

      {!session?.local && !session?.repositoryAccess ? (
        <div className="admin-banner access" role="status">
          <TriangleAlert size={17} />
          <span>Reconnect GitHub to create catalog pull requests and manage repository activity.</span>
          <a href="/api/auth/github">Reconnect GitHub <ExternalLink size={14} /></a>
        </div>
      ) : null}

      {error || result ? (
        <div className={`admin-banner${error ? " error" : " success"}`} role={error ? "alert" : "status"}>
          {error ? <><X size={17} /><span>{error}</span></> : result?.localPreview ? (
            <><Check size={17} /><span>Local sandbox updated. Repository files were not changed.</span></>
          ) : (
            <><Check size={17} /><span>Pull request #{result?.pullRequest?.number} created</span><a href={result?.pullRequest?.url} target="_blank" rel="noreferrer">Review PR <ExternalLink size={14} /></a></>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => { setError(""); setResult(null); }}><X size={15} /></button>
        </div>
      ) : null}

      {mode === "add" ? <AddLogoForm busy={busy} onBack={() => setMode("manage")} onSubmit={mutate} /> :
      mode === "requests" ? <RequestsManager /> :
      mode === "notifications" ? <NotificationsManager onUnreadChange={setUnreadNotifications} /> : (
        <main className="admin-workspace">
          <aside className="admin-catalog">
            <div className="admin-catalog-heading">
              <div><strong>Logo catalog</strong><small>{filtered.length} of {data?.catalog.length ?? 0}</small></div>
              <button type="button" onClick={() => setMode("add")} aria-label="Add logo" title="Add logo"><Plus size={17} /></button>
            </div>
            <label className="admin-search"><Search size={16} /><span className="admin-visually-hidden">Search catalog</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or slug" /></label>
            <div className="admin-logo-list">
              {filtered.map((logo) => (
                <button key={logo.slug} aria-current={logo.slug === selectedSlug ? "true" : undefined} className={logo.slug === selectedSlug ? "active" : ""} onClick={() => setSelectedSlug(logo.slug)}>
                  <span className="admin-list-preview">{logoPreview(logo.slug, logo.preview_url) ? <img src={logoPreview(logo.slug, logo.preview_url)!} alt="" /> : <ImagePlus size={16} />}</span>
                  <span><strong>{logo.name}</strong><small>{logoCategorySummary(logo)}</small></span>
                  <b title="Logo variations">{(data?.variations[logo.slug] ?? []).length}</b>
                </button>
              ))}
              {!filtered.length ? <div className="admin-list-empty"><Search size={18} /><strong>No logos found</strong><span>Try another name or slug.</span></div> : null}
            </div>
          </aside>
          {selected ? (
            <section className="admin-detail">
              <div className="admin-detail-heading">
                <div>
                  <p className={`admin-status ${selected.status}`}>{selected.status.replace("-", " ")}</p>
                  <h1>{selected.name}</h1>
                  <p className="admin-logo-meta"><span>{selected.slug}</span><span>{logoCategorySummary(selected)}</span></p>
                </div>
                <a href={selected.website} target="_blank" rel="noreferrer">Official website <ExternalLink size={14} /></a>
              </div>
              <div className="admin-asset-overview">
                <div className="admin-primary-preview">
                  {logoPreview(selected.slug, selected.preview_url) ? <img src={logoPreview(selected.slug, selected.preview_url)!} alt={`${selected.name} logo`} /> : <span>Preview unavailable</span>}
                </div>
                <section className="admin-primary-files">
                  <div><h2>Primary files</h2><p>{selected.formats.length} available format{selected.formats.length === 1 ? "" : "s"}</p></div>
                  <FormatFiles formats={selected.formats} slug={selected.slug} local={session?.local} />
                </section>
              </div>
              <VariationManager logo={selected} variations={selectedVariations} busy={busy} local={session?.local} mutate={mutate} />
              <DangerZone logo={selected} locked={data?.lockedSlugs.includes(selected.slug) ?? false} busy={busy} mutate={mutate} />
            </section>
          ) : <section className="admin-empty">Select a logo</section>}
        </main>
      )}
      {busy ? <div className="admin-busy" role="status"><LoaderCircle className="spin" /><span>Saving catalog changes</span></div> : null}
    </div>
  );
}

const requestStatusOptions: Array<[LogoRequestStatus, string]> = [
  ["pending", "Pending"],
  ["in-review", "In review"],
  ["needs-info", "Needs information"],
  ["approved", "Approved"],
  ["completed", "Completed"],
  ["rejected", "Rejected"]
];

function readableReason(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function RequestsManager() {
  const [requests, setRequests] = useState<LogoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [integrationMessage, setIntegrationMessage] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LogoRequestStatus | "all">("all");
  const [category, setCategory] = useState("all");
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);

  async function loadRequests(): Promise<LogoRequest[]> {
    setLoading(true);
    setError("");
    try {
      const response = await api<{ requests: LogoRequest[]; integration?: IntegrationState }>("/api/admin/requests");
      setRequests(response.requests);
      setIntegrationMessage(response.integration?.available === false ? response.integration.message ?? "GitHub requests are unavailable." : "");
      return response.requests;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load requests");
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRequests(); }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return requests.filter((item) =>
      (status === "all" || item.status === status) &&
      (category === "all" || item.category === category) &&
      (!normalized || `${item.institution} ${item.category} ${item.submitter} ${item.number}`.toLowerCase().includes(normalized))
    );
  }, [category, query, requests, status]);

  const requestCategories = useMemo(() => [...new Set(requests.map((item) => item.category))].sort(), [requests]);
  const selectedRequest = visible.find((item) => item.number === selectedNumber) ?? visible[0] ?? null;

  useEffect(() => {
    if (selectedRequest && selectedRequest.number !== selectedNumber) setSelectedNumber(selectedRequest.number);
    if (!selectedRequest && selectedNumber !== null) setSelectedNumber(null);
  }, [selectedNumber, selectedRequest]);

  async function updateStatus(item: LogoRequest, nextStatus: LogoRequestStatus) {
    setSaving(item.number);
    setError("");
    try {
      const response = await api<{ request: LogoRequest }>("/api/admin/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: item.number, status: nextStatus })
      });
      setRequests((current) => current.map((request) => request.number === item.number ? response.request : request));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update request");
    } finally {
      setSaving(null);
    }
  }

  const pendingCount = requests.filter((item) => item.status === "pending").length;
  const inReviewCount = requests.filter((item) => item.status === "in-review" || item.status === "needs-info").length;
  const resolvedCount = requests.filter((item) => item.status === "approved" || item.status === "completed").length;

  return (
    <main className="admin-request-dashboard">
      <header className="admin-cms-heading request-page-heading">
        <div><p className="admin-kicker">Request operations</p><h1>Request dashboard</h1><p>Review community requests, verify supplied assets, and keep publication status current.</p></div>
        <div className="admin-heading-actions">
          <button type="button" disabled={loading} onClick={loadRequests}><RefreshCw className={loading ? "spin" : ""} size={17} /> Refresh</button>
        </div>
      </header>
      <section className="admin-request-summary" aria-label="Request status summary">
        <div><span>All requests</span><strong>{requests.length}</strong></div>
        <div><span>New</span><strong>{pendingCount}</strong></div>
        <div><span>In progress</span><strong>{inReviewCount}</strong></div>
        <div><span>Published</span><strong>{resolvedCount}</strong></div>
      </section>
      <div className="admin-request-filters">
        <label className="admin-search"><Search size={17} /><span className="admin-visually-hidden">Search requests</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by institution, category, or issue" /></label>
        <label className="admin-filter"><span>Type</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All request types</option>{requestCategories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="admin-filter"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as LogoRequestStatus | "all")}><option value="all">All statuses</option>{requestStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {integrationMessage ? <div className="admin-inline-message warning" role="status"><TriangleAlert size={17} /> {integrationMessage}</div> : null}
      {error ? <div className="admin-inline-message error" role="alert"><X size={17} /> {error}</div> : null}
      {loading ? <AdminQueueLoading /> : (
        <section className="admin-request-split">
          <div className="admin-request-index">
            <header><span>{visible.length} request{visible.length === 1 ? "" : "s"}</span><span>Newest first</span></header>
            <div className="admin-request-index-list">
              {visible.map((item) => (
                <button aria-current={selectedRequest?.number === item.number ? "true" : undefined} className={selectedRequest?.number === item.number ? "active" : ""} key={item.number} onClick={() => setSelectedNumber(item.number)}>
                  <span className={`admin-request-state status-${item.status}`} />
                  <span><strong>{item.institution}</strong><small>#{item.number} · {item.category}</small></span>
                  <time dateTime={item.submittedAt}>{shortDate(item.submittedAt)}</time>
                </button>
              ))}
              {!visible.length ? <AdminQueueEmpty icon={<Search size={22} />} title="No matching requests" detail="Change the search, type, or status filters." /> : null}
            </div>
          </div>
          <div className="admin-request-review">
            {selectedRequest ? (
              <>
                <header className="admin-request-review-heading">
                  <div><p className="admin-kicker">Request #{selectedRequest.number}</p><h2>{selectedRequest.institution}</h2><p>{selectedRequest.category} · submitted by @{selectedRequest.submitter}</p></div>
                  <a className="admin-icon-link" href={selectedRequest.issueUrl} target="_blank" rel="noreferrer" aria-label={`Open request ${selectedRequest.number} on GitHub`} title="Open on GitHub"><ExternalLink size={17} /></a>
                </header>
                <dl className="admin-request-details">
                  <div><dt>Submitted</dt><dd>{shortDate(selectedRequest.submittedAt)}</dd></div>
                  <div><dt>Availability notice</dt><dd>{selectedRequest.notifyWhenAvailable ? "Requested" : "Not requested"}</dd></div>
                  <div><dt>Requester email</dt><dd>{selectedRequest.email ? <a href={`mailto:${selectedRequest.email}`}>{selectedRequest.email}</a> : "Not available"}</dd></div>
                  <div><dt>Official website</dt><dd>{selectedRequest.website ? <a href={selectedRequest.website} target="_blank" rel="noreferrer">{selectedRequest.website.replace(/^https?:\/\//, "")} <ExternalLink size={13} /></a> : "Not provided"}</dd></div>
                  <div><dt>Submitted asset</dt><dd>{selectedRequest.assetUrl ? <a href={selectedRequest.assetUrl} target="_blank" rel="noreferrer">Review asset <ExternalLink size={13} /></a> : "Not provided"}</dd></div>
                </dl>
                <section className="admin-request-status-panel">
                  <div><h3>Publication status</h3><p>Update the request as it moves through review.</p></div>
                  <label className="admin-status-select"><span className="admin-visually-hidden">Status for {selectedRequest.institution}</span><select className={`status-${selectedRequest.status}`} disabled={saving === selectedRequest.number} value={selectedRequest.status} onChange={(event) => updateStatus(selectedRequest, event.target.value as LogoRequestStatus)}>{requestStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                </section>
              </>
            ) : (
              <div className="admin-request-review-empty"><ClipboardList size={22} /><span>Select a request to review it</span></div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function NotificationsManager({ onUnreadChange }: { onUnreadChange: (count: number) => void }) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [integrationMessage, setIntegrationMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState("");

  async function loadNotifications() {
    setLoading(true);
    setError("");
    try {
      const response = await api<{ notifications: AdminNotification[]; integration?: IntegrationState }>("/api/admin/notifications");
      setNotifications(response.notifications);
      setIntegrationMessage(response.integration?.available === false ? response.integration.message ?? "GitHub notifications are unavailable." : "");
      onUnreadChange(response.notifications.filter((item) => item.unread).length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadNotifications(); }, [onUnreadChange]);

  const visible = filter === "unread" ? notifications.filter((item) => item.unread) : notifications;

  async function markRead(item: AdminNotification) {
    setSaving(item.id);
    setError("");
    try {
      const response = await api<{ notifications: AdminNotification[] }>("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id })
      });
      setNotifications(response.notifications);
      onUnreadChange(response.notifications.filter((notification) => notification.unread).length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update notification");
    } finally {
      setSaving("");
    }
  }

  const unread = notifications.filter((item) => item.unread).length;
  const pendingRequests = notifications.filter((item) => item.unread && item.type === "Issue").length;
  const readyToReview = notifications.filter((item) => item.unread && item.type === "PullRequest").length;
  const needsReview = notifications.filter((item) => item.unread && item.type !== "Issue" && item.type !== "PullRequest").length;

  async function runCheck() {
    setChecking(true);
    setCheckMessage("");
    try {
      await loadNotifications();
      setCheckMessage("Notification sources checked just now.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="admin-notification-dashboard">
      <header className="admin-cms-heading notification-page-heading">
        <div><p className="admin-kicker">Automatic publication alerts</p><h1>Logo notifications</h1><p>Review request activity, publication updates, and repository events from one queue.</p></div>
        <div className="admin-heading-actions">
          <button type="button" disabled={loading} onClick={loadNotifications}><RefreshCw className={loading ? "spin" : ""} size={17} /> Refresh</button>
          <button className="primary" type="button" disabled={checking || loading} onClick={runCheck}><Send size={17} /> {checking ? "Checking" : "Run automatic check"}</button>
        </div>
      </header>
      <section className="admin-notification-summary" aria-label="Notification status summary">
        <div><strong>{pendingRequests}</strong><span>Pending requests</span></div>
        <div><strong>{readyToReview}</strong><span>Ready to review</span></div>
        <div><strong>{needsReview}</strong><span>Need review</span></div>
      </section>
      <div className="admin-notification-queue-heading">
        <div><h2>Notification queue</h2><p>Repository and request updates are shown without exposing private requester contact details.</p></div>
        <div className="admin-segmented" aria-label="Notification filter">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All <span>{notifications.length}</span></button>
          <button className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>Unread <span>{unread}</span></button>
        </div>
      </div>
      {checkMessage ? <div className="admin-check-message" role="status"><Check size={15} /> {checkMessage}</div> : null}
      {integrationMessage ? <div className="admin-inline-message warning" role="status"><TriangleAlert size={17} /> {integrationMessage}</div> : null}
      {error ? <div className="admin-inline-message error" role="alert"><X size={17} /> {error}</div> : null}
      {loading ? <AdminQueueLoading /> : visible.length ? (
        <div className="admin-notification-list">
          {visible.map((item) => (
            <article className={`admin-notification-row${item.unread ? " unread" : ""}`} key={item.id}>
              <span className="admin-notification-icon">{item.type === "Issue" ? <MessageSquare size={18} /> : item.type === "PullRequest" ? <GitFork size={18} /> : <ShieldCheck size={18} />}</span>
              <div><strong>{item.title}</strong><p>{readableReason(item.reason)} · {item.type}</p><time dateTime={item.updatedAt}>{shortDate(item.updatedAt)}</time></div>
              <div className="admin-notification-actions">
                {item.unread ? <button disabled={saving === item.id} onClick={() => markRead(item)}><MailCheck size={16} /> Mark read</button> : <span><Check size={14} /> Read</span>}
                <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`} title="Open on GitHub"><ExternalLink size={17} /></a>
              </div>
            </article>
          ))}
        </div>
      ) : <AdminQueueEmpty icon={<Check size={22} />} title={filter === "unread" ? "No notifications are waiting" : "No notifications"} detail={filter === "unread" ? "The notification queue is up to date." : "Repository activity will appear here."} />}
      <details className="admin-notification-notes">
        <summary>Notification delivery notes</summary>
        <p>Requester email addresses remain private. Public issue data shown here never includes submitted contact details.</p>
      </details>
    </main>
  );
}

function AdminQueueLoading() {
  return <div className="admin-queue-loading" aria-label="Loading"><span /><span /><span /></div>;
}

function AdminQueueEmpty({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="admin-queue-empty">{icon}<strong>{title}</strong><p>{detail}</p></div>;
}

function CategoryMultiSelect({
  value,
  onChange
}: {
  value: InstitutionCategory[];
  onChange: (categories: InstitutionCategory[]) => void;
}) {
  function toggle(category: InstitutionCategory) {
    onChange(value.includes(category)
      ? value.filter((item) => item !== category)
      : [...value, category]);
  }

  return (
    <fieldset className="admin-category-picker">
      <legend>Categories</legend>
      <details>
        <summary>
          <span>{value.length ? `${value.length} categor${value.length === 1 ? "y" : "ies"} selected` : "Select categories"}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="admin-category-options" role="group" aria-label="Institution categories">
          {availableInstitutionCategories.map((category) => {
            const selected = value.includes(category);
            return (
              <label className={selected ? "selected" : ""} key={category}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggle(category)}
                />
                <span>{categoryLabel(category)}</span>
                {selected ? <Check size={15} aria-hidden="true" /> : null}
              </label>
            );
          })}
        </div>
      </details>
      {value.length ? (
        <div className="admin-category-selection" aria-live="polite">
          {value.map((category) => (
            <button type="button" key={category} onClick={() => toggle(category)} title={`Remove ${categoryLabel(category)}`}>
              {categoryLabel(category)}
              <X size={12} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : <small>Select at least one category used by the public catalog.</small>}
    </fieldset>
  );
}

function AddLogoForm({ busy, onBack, onSubmit }: { busy: boolean; onBack: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [manualSlug, setManualSlug] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<InstitutionCategory[]>([]);
  const [officialSourceUnavailable, setOfficialSourceUnavailable] = useState(false);
  const [variationDrafts, setVariationDrafts] = useState<VariationDraft[]>([]);

  const duplicateVariationIds = new Set(variationDrafts
    .map((variation) => variation.id)
    .filter((id, index, ids) => id && ids.indexOf(id) !== index));
  const totalAssetBytes = (file?.size ?? 0) + variationDrafts.reduce((total, variation) => total + (variation.file?.size ?? 0), 0);
  const uploadBundleTooLarge = totalAssetBytes > 2_500_000;
  const variationsReady = variationDrafts.every((variation) =>
    variation.name.trim().length >= 2 && variation.id && variation.file
  ) && duplicateVariationIds.size === 0 && !uploadBundleTooLarge;

  function addVariation() {
    setVariationDrafts((current) => [...current, {
      key: crypto.randomUUID(),
      id: "",
      name: "",
      sourceUrl: "",
      file: null
    }]);
  }

  function updateVariation(key: string, patch: Partial<VariationDraft>) {
    setVariationDrafts((current) => current.map((variation) =>
      variation.key === key ? { ...variation, ...patch } : variation
    ));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData(event.currentTarget);
    const variations = await Promise.all(variationDrafts.map(async (variation) => ({
      id: variation.id,
      name: variation.name,
      sourceUrl: variation.sourceUrl.trim() || undefined,
      svgBase64: await fileToBase64(variation.file!)
    })));
    const ok = await onSubmit({
      operation: "add-logo",
      name,
      slug,
      categories: selectedCategories,
      aliases: String(form.get("aliases") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      website: form.get("website"),
      sourceUrl: String(form.get("sourceUrl") ?? "").trim() || undefined,
      sourceType: officialSourceUnavailable ? "community-catalog" : form.get("sourceType"),
      svgBase64: await fileToBase64(file),
      variations
    });
    if (ok) {
      event.currentTarget.reset();
      setName("");
      setSlug("");
      setManualSlug(false);
      setFile(null);
      setSelectedCategories([]);
      setOfficialSourceUnavailable(false);
      setVariationDrafts([]);
    }
  }

  return (
    <main className="admin-form-page">
      <div className="admin-page-heading">
        <button className="admin-form-back" type="button" onClick={onBack}><ArrowLeft size={16} /> Back to catalog</button>
        <p className="admin-kicker">New catalog entry</p>
        <h1>Add a logo</h1>
      </div>
      <form className="admin-form-grid" onSubmit={submit}>
        <section className="admin-form-section">
          <h2>Institution</h2>
          <div className="admin-fields two">
            <label><span>Name</span><input required value={name} onChange={(event) => { setName(event.target.value); if (!manualSlug) setSlug(slugify(event.target.value)); }} placeholder="Access Bank" /></label>
            <label><span>Slug</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => { setManualSlug(true); setSlug(event.target.value); }} placeholder="access-bank" /></label>
            <CategoryMultiSelect value={selectedCategories} onChange={setSelectedCategories} />
            <label><span>Aliases</span><input name="aliases" placeholder="Access, Access Bank Plc" /></label>
          </div>
        </section>
        <section className="admin-form-section">
          <div className="admin-form-section-heading">
            <div><h2>Source and provenance</h2><p>Classify where the submitted artwork came from.</p></div>
            <label className="admin-source-toggle">
              <input type="checkbox" role="switch" checked={officialSourceUnavailable} onChange={(event) => setOfficialSourceUnavailable(event.target.checked)} />
              <span aria-hidden="true" />
              <strong>Official logo source unavailable</strong>
            </label>
          </div>
          <div className="admin-fields two">
            <label><span>Website</span><input name="website" type="url" required placeholder="https://company.com" /></label>
            <label><span>{officialSourceUnavailable ? "Provenance URL (optional)" : "Official logo source URL"}</span><input name="sourceUrl" type="url" required={!officialSourceUnavailable} placeholder={officialSourceUnavailable ? "https://archive.org/or/submission" : "https://company.com/brand"} /></label>
            {officialSourceUnavailable ? (
              <div className="admin-source-classification"><span>Source classification</span><strong>Community supplied</strong><small>The entry remains needs-review and is never presented as officially verified.</small></div>
            ) : (
              <label><span>Source type</span><select name="sourceType" required>{sourceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            )}
          </div>
        </section>
        <section className="admin-form-section asset"><div><h2>Logo asset</h2><p>PNG and WebP derivatives are generated automatically.</p></div><UploadField file={file} onFile={setFile} /></section>
        <section className="admin-form-section admin-variation-drafts">
          <div className="admin-form-section-heading">
            <div><h2>Logo variations</h2><p>Add wordmarks, symbols, light, dark, or stacked versions to the same pull request.</p></div>
            <button className="admin-secondary-action" type="button" onClick={addVariation} disabled={variationDrafts.length >= 12}><Plus size={16} /> Add variation</button>
          </div>
          {variationDrafts.length ? (
            <div className="admin-variation-draft-list">
              {variationDrafts.map((variation, index) => (
                <article className="admin-variation-draft" key={variation.key}>
                  <header><div><span>Variation {index + 1}</span><strong>{variation.name || "Untitled variation"}</strong></div><button type="button" onClick={() => setVariationDrafts((current) => current.filter((item) => item.key !== variation.key))} aria-label={`Remove variation ${index + 1}`} title="Remove variation"><Trash2 size={16} /></button></header>
                  <div className="admin-variation-draft-content">
                    <div className="admin-fields two">
                      <label><span>Name</span><input required value={variation.name} onChange={(event) => { const nextName = event.target.value; updateVariation(variation.key, { name: nextName, id: slugify(nextName) }); }} placeholder="Light wordmark" /></label>
                      <label><span>Variation ID</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={variation.id} onChange={(event) => updateVariation(variation.key, { id: event.target.value })} aria-invalid={duplicateVariationIds.has(variation.id)} placeholder="light-wordmark" />{duplicateVariationIds.has(variation.id) ? <small className="admin-field-error">Use a unique variation ID.</small> : null}</label>
                      <label className="admin-field-wide"><span>Source URL (optional)</span><input type="url" value={variation.sourceUrl} onChange={(event) => updateVariation(variation.key, { sourceUrl: event.target.value })} placeholder="Uses the primary source when left empty" /></label>
                    </div>
                    <UploadField file={variation.file} onFile={(nextFile) => updateVariation(variation.key, { file: nextFile })} />
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="admin-inline-empty"><ImagePlus size={18} /> No additional variations</div>}
        </section>
        <div className="admin-submit-row"><span className={uploadBundleTooLarge ? "admin-submit-warning" : ""}>{uploadBundleTooLarge ? "Combined SVG files must stay below 2.5 MB." : variationDrafts.length ? `Primary logo and ${variationDrafts.length} variation${variationDrafts.length === 1 ? "" : "s"} will be submitted together.` : "New entries are submitted as needs-review."}</span><button disabled={busy || !file || !selectedCategories.length || !variationsReady} type="submit"><GitFork size={17} /> Create pull request</button></div>
      </form>
    </main>
  );
}

function VariationManager({ logo, variations, busy, local, mutate }: { logo: Logo; variations: Variation[]; busy: boolean; local?: boolean; mutate: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [variationId, setVariationId] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (!adding) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[role="dialog"] input')?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAdding(false);
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      if (dialog) keepFocusInDialog(event, dialog);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [adding]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData(event.currentTarget);
    const ok = await mutate({ operation: "add-variation", slug: logo.slug, variationId, name, sourceUrl: form.get("sourceUrl"), svgBase64: await fileToBase64(file) });
    if (ok) { setAdding(false); setFile(null); setName(""); setVariationId(""); }
  }

  return (
    <section className="admin-variations">
      <div className="admin-section-heading"><div><h2>Variations</h2><p>{variations.length} additional asset{variations.length === 1 ? "" : "s"}</p></div><button onClick={() => setAdding(true)}><Plus size={16} /> Add variation</button></div>
      {variations.length ? <div className="admin-variation-grid">{variations.map((variation) => (
        <article key={variation.id}>
          <div className="admin-variation-preview">{variationPreview(logo.slug, variation.id, variation.preview_url) ? <img src={variationPreview(logo.slug, variation.id, variation.preview_url)!} alt="" /> : <ImagePlus size={20} />}</div>
          <div className="admin-variation-meta">
            <strong>{variation.name}</strong>
            <small>{variation.id}</small>
          </div>
          <button aria-label={`Remove ${variation.name}`} title="Remove variation" onClick={() => { setConfirming(variation.id); setConfirmation(""); }}><Trash2 size={16} /></button>
          <FormatFiles formats={variation.formats} slug={logo.slug} variationId={variation.id} local={local} />
        </article>
      ))}</div> : <div className="admin-inline-empty"><ImagePlus size={18} /> No variations added</div>}

      {adding ? <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdding(false); }}><form className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="add-variation-title" onSubmit={add}>
        <button className="admin-dialog-close" type="button" onClick={() => setAdding(false)} aria-label="Close"><X size={18} /></button>
        <p className="admin-kicker">{logo.name}</p><h2 id="add-variation-title">Add variation</h2>
        <div className="admin-fields"><label><span>Name</span><input required value={name} onChange={(event) => { setName(event.target.value); setVariationId(slugify(event.target.value)); }} placeholder="Light wordmark" /></label><label><span>Variation ID</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={variationId} onChange={(event) => setVariationId(event.target.value)} /></label><label><span>Official source URL</span><input required name="sourceUrl" type="url" placeholder="https://company.com/brand" /></label></div>
        <UploadField file={file} onFile={setFile} />
        <button className="admin-primary-button" disabled={busy || !file} type="submit"><GitFork size={17} /> Create pull request</button>
      </form></div> : null}

      {confirming ? <ConfirmDialog title="Remove variation" token={confirming} value={confirmation} onChange={setConfirmation} busy={busy} onCancel={() => setConfirming(null)} onConfirm={async () => { const ok = await mutate({ operation: "remove-variation", slug: logo.slug, variationId: confirming, confirmation }); if (ok) setConfirming(null); }} /> : null}
    </section>
  );
}

function DangerZone({ logo, locked, busy, mutate }: { logo: Logo; locked: boolean; busy: boolean; mutate: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  return <section className="admin-danger"><div><h2>Remove logo</h2><p>{locked ? "This core entry is managed in code." : "Removes the logo, variations and unshared asset files."}</p></div><button disabled={locked} onClick={() => setOpen(true)}><Trash2 size={16} /> Remove</button>{open ? <ConfirmDialog title="Remove catalog entry" token={logo.slug} value={confirmation} onChange={setConfirmation} busy={busy} onCancel={() => setOpen(false)} onConfirm={async () => { const ok = await mutate({ operation: "remove-logo", slug: logo.slug, confirmation }); if (ok) setOpen(false); }} /> : null}</section>;
}

function ConfirmDialog({ title, token, value, onChange, busy, onCancel, onConfirm }: { title: string; token: string; value: string; onChange: (value: string) => void; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[role="dialog"] input')?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      if (dialog) keepFocusInDialog(event, dialog);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onCancel]);

  const titleId = `confirm-${token}`;
  return <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><div className="admin-dialog confirm" role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="admin-danger-icon"><Trash2 size={19} /></div><h2 id={titleId}>{title}</h2><p>Type <strong>{token}</strong> to confirm.</p><label><span>Confirmation</span><input autoFocus value={value} onChange={(event) => onChange(event.target.value)} /></label><div className="admin-dialog-actions"><button onClick={onCancel}>Cancel</button><button className="danger" disabled={busy || value !== token} onClick={onConfirm}>Remove in pull request</button></div></div></div>;
}
