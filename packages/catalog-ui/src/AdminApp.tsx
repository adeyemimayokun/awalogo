import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  BellRing,
  Building2,
  Check,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileCode2,
  GitFork,
  ImagePlus,
  Inbox,
  Link2,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { logos as bundledLogos } from "./logo-data";
import "./admin.css";

type Session = { login: string; avatarUrl: string };
type Format = { type: string; path: string };
type Variation = { id: string; name: string; source_url?: string; svg_path: string | null; formats: Format[] };
type Logo = {
  name: string;
  slug: string;
  category: string;
  website: string;
  source_url: string;
  svg_path: string | null;
  formats: Format[];
  status: string;
};
type CatalogResponse = { catalog: Logo[]; variations: Record<string, Variation[]>; lockedSlugs: string[] };
type MutationResult = { pullRequest: { number: number; url: string } };
type NotificationQueueItem = {
  segmentId: string;
  requestKey: string;
  requestedName: string;
  status: "ready" | "ambiguous" | "unmatched";
  matches: Array<{ slug: string; name: string }>;
  createdAt?: string;
};
type NotificationQueueResponse = {
  queue: NotificationQueueItem[];
  summary: {
    total: number;
    ready: number;
    ambiguous: number;
    unmatched: number;
  };
};
type NotificationDispatchResult = {
  processedSegments: number;
  notified: number;
  skippedUnsubscribed: number;
  failed: number;
};
type RequestStatus = "new" | "reviewing" | "sourcing" | "ready" | "published" | "declined";
type RequestType = "logo-request" | "company-submission";
type AdminRequest = {
  number: number;
  title: string;
  institutionName: string;
  requestType: RequestType;
  status: RequestStatus;
  category: string;
  officialWebsite: string | null;
  assetFormat: string | null;
  assetUrl: string | null;
  brandGuidelinesUrl: string | null;
  submitterRole: string | null;
  notificationRequested: boolean;
  githubUrl: string;
  authorLogin: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};
type RequestDashboardResponse = {
  requests: AdminRequest[];
  summary: {
    total: number;
    new: number;
    active: number;
    published: number;
    declined: number;
  };
};

const requestStatuses: Array<{ value: RequestStatus; label: string; shortLabel: string }> = [
  { value: "new", label: "New", shortLabel: "New" },
  { value: "reviewing", label: "In review", shortLabel: "Review" },
  { value: "sourcing", label: "Sourcing asset", shortLabel: "Sourcing" },
  { value: "ready", label: "Ready to publish", shortLabel: "Ready" },
  { value: "published", label: "Published", shortLabel: "Published" },
  { value: "declined", label: "Declined", shortLabel: "Declined" }
];

const categories = [
  ["commercial-bank", "Commercial bank"],
  ["microfinance-bank", "Microfinance bank"],
  ["merchant-bank", "Merchant bank"],
  ["payment-bank", "Payment service bank"],
  ["fintech", "Fintech"],
  ["other", "Other"]
] as const;

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

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function logoPreview(slug: string): string | null {
  const logo = bundledLogos.find((item) => item.slug === slug);
  return logo?.svg ? svgDataUrl(logo.svg) : logo?.asset_urls.png ?? logo?.asset_urls.webp ?? null;
}

function variationPreview(slug: string, variationId: string): string | null {
  const variation = bundledLogos.find((item) => item.slug === slug)?.variations.find((item) => item.id === variationId);
  return variation?.svg ? svgDataUrl(variation.svg) : variation?.asset_urls.png ?? variation?.asset_urls.webp ?? null;
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

export function AdminApp() {
  const [auth, setAuth] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [notificationData, setNotificationData] = useState<NotificationQueueResponse | null>(null);
  const [requestData, setRequestData] = useState<RequestDashboardResponse | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [mode, setMode] = useState<"requests" | "manage" | "add" | "notify">("requests");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MutationResult | null>(null);
  const [emailNotice, setEmailNotice] = useState("");

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

  async function loadNotificationQueue() {
    setNotificationLoading(true);
    try {
      setNotificationData(await api<NotificationQueueResponse>("/api/admin/logo-notifications"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The notification queue could not be loaded");
    } finally {
      setNotificationLoading(false);
    }
  }

  async function loadRequests() {
    setRequestLoading(true);
    try {
      const next = await api<RequestDashboardResponse>("/api/admin/requests");
      if (!Array.isArray(next.requests) || !next.summary) throw new Error("The request API returned an invalid response");
      setRequestData(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Requests could not be loaded");
    } finally {
      setRequestLoading(false);
    }
  }

  useEffect(() => {
    api<{ user: Session }>("/api/auth/session")
      .then(async ({ user }) => {
        setSession(user);
        setAuth("signed-in");
        await loadCatalog();
      })
      .catch(() => setAuth("signed-out"));
  }, []);

  useEffect(() => {
    if (auth === "signed-in" && mode === "notify") void loadNotificationQueue();
    if (auth === "signed-in" && mode === "requests") void loadRequests();
  }, [auth, mode]);

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
    setEmailNotice("");
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

  async function notifyLogoLive(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setResult(null);
    setEmailNotice("");
    try {
      await api<{ ok: true }>("/api/admin/notify-logo-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setEmailNotice("The logo availability email was sent.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The email could not be sent");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function dispatchNotificationQueue(payload: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    setResult(null);
    setEmailNotice("");
    try {
      const { result: dispatch } = await api<{ ok: true; result: NotificationDispatchResult }>(
        "/api/admin/logo-notifications",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      setEmailNotice(
        dispatch.notified > 0
          ? `${dispatch.notified} availability ${dispatch.notified === 1 ? "email was" : "emails were"} sent.`
          : "The queue is up to date. No availability emails were ready to send."
      );
      await loadNotificationQueue();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The notification run failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function updateRequestStatus(issueNumber: number, status: RequestStatus) {
    setBusy(true);
    setError("");
    setResult(null);
    setEmailNotice("");
    try {
      const { request: updated } = await api<{ request: AdminRequest }>("/api/admin/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueNumber, status })
      });
      setRequestData((current) => {
        if (!current) return current;
        const requests = current.requests.map((request) => request.number === updated.number ? updated : request);
        return {
          requests,
          summary: {
            total: requests.length,
            new: requests.filter((request) => request.status === "new").length,
            active: requests.filter((request) => ["reviewing", "sourcing", "ready"].includes(request.status)).length,
            published: requests.filter((request) => request.status === "published").length,
            declined: requests.filter((request) => request.status === "declined").length
          }
        };
      });
      const label = requestStatuses.find((option) => option.value === status)?.label ?? status;
      setEmailNotice(`Request #${issueNumber} moved to ${label}.`);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request status could not be updated");
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
    return <main className="admin-state"><LoaderCircle className="spin" aria-hidden="true" /><span>Checking session</span></main>;
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
        <a className="admin-brand" href="/"><span>NG</span><div><strong>Logo Admin</strong><small>Repository CMS</small></div></a>
        <div className="admin-account">
          <img src={session?.avatarUrl} alt="" />
          <span>@{session?.login}</span>
          <button type="button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Admin sections">
        <button className={mode === "requests" ? "active" : ""} onClick={() => setMode("requests")}><ClipboardList size={16} /> Requests</button>
        <button className={mode === "manage" ? "active" : ""} onClick={() => setMode("manage")}><FileCode2 size={16} /> Manage logos</button>
        <button className={mode === "add" ? "active" : ""} onClick={() => setMode("add")}><Plus size={16} /> Add logo</button>
        <button className={mode === "notify" ? "active" : ""} onClick={() => setMode("notify")}><BellRing size={16} /> Notifications</button>
        <span>{mode === "requests" ? `${requestData?.summary.total ?? 0} requests` : `${data?.catalog.length ?? 0} managed entries`}</span>
      </nav>

      {error || result || emailNotice ? (
        <div className={`admin-banner${error ? " error" : " success"}`}>
          {error ? (
            <><X size={17} /><span>{error}</span></>
          ) : result ? (
            <><Check size={17} /><span>Pull request #{result.pullRequest.number} created</span><a href={result.pullRequest.url} target="_blank" rel="noreferrer">Review PR <ExternalLink size={14} /></a></>
          ) : (
            <><Check size={17} /><span>{emailNotice}</span></>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => { setError(""); setResult(null); setEmailNotice(""); }}><X size={15} /></button>
        </div>
      ) : null}

      {mode === "requests" ? (
        <RequestWorkspace
          data={requestData}
          loading={requestLoading}
          busy={busy}
          onRefresh={loadRequests}
          onUpdateStatus={updateRequestStatus}
        />
      ) : mode === "add" ? (
        <AddLogoForm busy={busy} onSubmit={mutate} />
      ) : mode === "notify" ? (
        <LogoNotificationWorkspace
          busy={busy}
          logos={data?.catalog ?? []}
          data={notificationData}
          loading={notificationLoading}
          onRefresh={loadNotificationQueue}
          onDispatch={dispatchNotificationQueue}
          onManualSubmit={notifyLogoLive}
        />
      ) : (
        <main className="admin-workspace">
          <aside className="admin-catalog">
            <label className="admin-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search catalog" /></label>
            <div className="admin-logo-list">
              {filtered.map((logo) => (
                <button key={logo.slug} className={logo.slug === selectedSlug ? "active" : ""} onClick={() => setSelectedSlug(logo.slug)}>
                  <span className="admin-list-preview">{logoPreview(logo.slug) ? <img src={logoPreview(logo.slug)!} alt="" /> : <ImagePlus size={16} />}</span>
                  <span><strong>{logo.name}</strong><small>{logo.category.replaceAll("-", " ")}</small></span>
                  <b>{(data?.variations[logo.slug] ?? []).length}</b>
                </button>
              ))}
            </div>
          </aside>
          {selected ? (
            <section className="admin-detail">
              <div className="admin-detail-heading">
                <div><p className="admin-kicker">{selected.status}</p><h1>{selected.name}</h1><p>{selected.slug}</p></div>
                <a href={selected.website} target="_blank" rel="noreferrer">Official website <ExternalLink size={14} /></a>
              </div>
              <div className="admin-primary-preview">
                {logoPreview(selected.slug) ? <img src={logoPreview(selected.slug)!} alt={`${selected.name} logo`} /> : <span>Preview available after deployment</span>}
              </div>
              <VariationManager logo={selected} variations={selectedVariations} busy={busy} mutate={mutate} />
              <DangerZone logo={selected} locked={data?.lockedSlugs.includes(selected.slug) ?? false} busy={busy} mutate={mutate} />
            </section>
          ) : <section className="admin-empty">Select a logo</section>}
        </main>
      )}
      {busy ? <div className="admin-busy" role="status"><LoaderCircle className="spin" /><span>Working on your request</span></div> : null}
    </div>
  );
}

function formatRequestDate(value: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const label = requestStatuses.find((option) => option.value === status)?.shortLabel ?? status;
  return <span className={`request-status ${status}`}>{label}</span>;
}

function RequestWorkspace({
  data,
  loading,
  busy,
  onRefresh,
  onUpdateStatus
}: {
  data: RequestDashboardResponse | null;
  loading: boolean;
  busy: boolean;
  onRefresh: () => Promise<void>;
  onUpdateStatus: (issueNumber: number, status: RequestStatus) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RequestStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | RequestType>("all");
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState<RequestStatus>("new");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.requests ?? []).filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) return false;
      if (typeFilter !== "all" && request.requestType !== typeFilter) return false;
      return !normalized || [
        request.institutionName,
        request.category,
        request.title,
        String(request.number)
      ].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [data, query, statusFilter, typeFilter]);

  const selected = (data?.requests ?? []).find((request) => request.number === selectedNumber)
    ?? filtered[0]
    ?? null;

  useEffect(() => {
    if (selected && selected.number !== selectedNumber) setSelectedNumber(selected.number);
  }, [selected, selectedNumber]);

  useEffect(() => {
    if (selected) setDraftStatus(selected.status);
  }, [selected?.number, selected?.status]);

  const workflowStatuses = requestStatuses.filter((status) => status.value !== "declined");
  const currentWorkflowIndex = workflowStatuses.findIndex((status) => status.value === selected?.status);

  return (
    <main className="request-workspace">
      <header className="request-heading">
        <div>
          <p className="admin-kicker">Request operations</p>
          <h1>Request dashboard</h1>
          <p>Review community requests, verify supplied assets, and keep publication status current.</p>
        </div>
        <button type="button" onClick={() => void onRefresh()} disabled={loading || busy}>
          <RefreshCw className={loading ? "spin" : ""} size={15} /> Refresh
        </button>
      </header>

      <section className="request-summary" aria-label="Request workload summary">
        <div><span>All requests</span><strong>{data?.summary.total ?? 0}</strong></div>
        <div><span>New</span><strong>{data?.summary.new ?? 0}</strong></div>
        <div><span>In progress</span><strong>{data?.summary.active ?? 0}</strong></div>
        <div><span>Published</span><strong>{data?.summary.published ?? 0}</strong></div>
      </section>

      <section className="request-toolbar" aria-label="Request filters">
        <label className="request-search">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by institution, category, or issue"
          />
        </label>
        <label>
          <span>Type</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | RequestType)}>
            <option value="all">All request types</option>
            <option value="logo-request">Logo requests</option>
            <option value="company-submission">Company submissions</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | RequestStatus)}>
            <option value="all">All statuses</option>
            {requestStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </label>
      </section>

      <section className="request-board">
        <div className="request-list-pane">
          <div className="request-list-header">
            <span>{filtered.length} {filtered.length === 1 ? "request" : "requests"}</span>
            <span>Newest first</span>
          </div>
          {loading && !data ? (
            <div className="request-list-empty"><LoaderCircle className="spin" size={17} /> Loading requests</div>
          ) : filtered.length ? (
            <div className="request-list">
              {filtered.map((request) => (
                <button
                  type="button"
                  key={request.number}
                  className={request.number === selected?.number ? "active" : ""}
                  onClick={() => setSelectedNumber(request.number)}
                >
                  <span className="request-type-icon" aria-hidden="true">
                    {request.requestType === "company-submission" ? <Building2 size={16} /> : <Inbox size={16} />}
                  </span>
                  <span className="request-row-copy">
                    <strong>{request.institutionName}</strong>
                    <small>{request.requestType === "company-submission" ? "Company submission" : "Logo request"} · #{request.number}</small>
                  </span>
                  <RequestStatusBadge status={request.status} />
                  <time dateTime={request.createdAt}>{formatRequestDate(request.createdAt)}</time>
                  <ChevronRight className="request-row-arrow" size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <div className="request-list-empty"><Search size={17} /> No requests match these filters</div>
          )}
        </div>

        <aside className="request-detail-pane" aria-label="Selected request details">
          {selected ? (
            <>
              <header className="request-detail-header">
                <div>
                  <div className="request-detail-eyebrow">
                    <RequestStatusBadge status={selected.status} />
                    <span>Issue #{selected.number}</span>
                  </div>
                  <h2>{selected.institutionName}</h2>
                  <p>{selected.requestType === "company-submission" ? "Official company submission" : "Community logo request"}</p>
                </div>
                <a href={selected.githubUrl} target="_blank" rel="noreferrer" title="Open request in GitHub">
                  <ExternalLink size={16} /><span>GitHub</span>
                </a>
              </header>

              <section className="request-progress" aria-label="Publication workflow">
                <div className="request-section-label">Publication workflow</div>
                <ol>
                  {workflowStatuses.map((status, index) => (
                    <li
                      key={status.value}
                      className={[
                        selected.status === "declined" ? "" : index < currentWorkflowIndex ? "complete" : "",
                        status.value === selected.status ? "current" : ""
                      ].filter(Boolean).join(" ")}
                    >
                      <span>{index < currentWorkflowIndex && selected.status !== "declined" ? <Check size={12} /> : index + 1}</span>
                      <small>{status.shortLabel}</small>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="request-status-editor">
                <label>
                  <span>Update status</span>
                  <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as RequestStatus)}>
                    {requestStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || draftStatus === selected.status}
                  onClick={() => void onUpdateStatus(selected.number, draftStatus)}
                >
                  <Check size={15} /> Save status
                </button>
              </section>

              <section className="request-metadata">
                <div><span>Category</span><strong>{selected.category}</strong></div>
                <div><span>Requested format</span><strong>{selected.assetFormat ?? "Not supplied"}</strong></div>
                <div><span>Submitted</span><strong>{formatRequestDate(selected.createdAt)}</strong></div>
                <div><span>Last updated</span><strong>{formatRequestDate(selected.updatedAt)}</strong></div>
                {selected.submitterRole ? <div><span>Submitter role</span><strong>{selected.submitterRole}</strong></div> : null}
                <div>
                  <span>Availability email</span>
                  <strong>{selected.notificationRequested ? "Requested" : "Not requested"}</strong>
                </div>
              </section>

              <section className="request-links">
                <div className="request-section-label">Sources and files</div>
                {selected.officialWebsite ? (
                  <a href={selected.officialWebsite} target="_blank" rel="noreferrer"><Link2 size={15} /><span><small>Official website</small>{selected.officialWebsite}</span><ExternalLink size={14} /></a>
                ) : null}
                {selected.assetUrl ? (
                  <a href={selected.assetUrl} target="_blank" rel="noreferrer"><FileCode2 size={15} /><span><small>Submitted asset</small>{selected.assetUrl}</span><ExternalLink size={14} /></a>
                ) : null}
                {selected.brandGuidelinesUrl ? (
                  <a href={selected.brandGuidelinesUrl} target="_blank" rel="noreferrer"><Link2 size={15} /><span><small>Brand guidelines</small>{selected.brandGuidelinesUrl}</span><ExternalLink size={14} /></a>
                ) : null}
                {!selected.officialWebsite && !selected.assetUrl && !selected.brandGuidelinesUrl ? (
                  <div className="request-link-empty">No public links were supplied.</div>
                ) : null}
              </section>

              <div className="request-privacy-note">
                <ShieldCheck size={16} aria-hidden="true" />
                <span><strong>Private by design.</strong> Requester email addresses stay in the email service and are never returned by this dashboard.</span>
              </div>
            </>
          ) : (
            <div className="request-detail-empty"><ClipboardList size={20} /><span>Select a request to review it</span></div>
          )}
        </aside>
      </section>
    </main>
  );
}

function LogoNotificationWorkspace({
  busy,
  logos,
  data,
  loading,
  onRefresh,
  onDispatch,
  onManualSubmit
}: {
  busy: boolean;
  logos: Logo[];
  data: NotificationQueueResponse | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onDispatch: (payload?: Record<string, unknown>) => Promise<boolean>;
  onManualSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <main className="admin-form-page notification-workspace">
      <div className="admin-page-heading notification-heading">
        <div>
          <p className="admin-kicker">Automatic publication email</p>
          <h1>Logo notifications</h1>
          <p className="admin-page-description">
            Exact name and alias matches send automatically each day. Review unmatched requests here.
          </p>
        </div>
        <div className="notification-heading-actions">
          <button type="button" onClick={() => void onRefresh()} disabled={loading || busy}>
            <RefreshCw className={loading ? "spin" : ""} size={15} /> Refresh
          </button>
          <button type="button" className="primary" onClick={() => void onDispatch()} disabled={loading || busy}>
            <Send size={15} /> Run automatic check
          </button>
        </div>
      </div>

      <section className="notification-summary" aria-label="Notification queue summary">
        <div><strong>{data?.summary.total ?? 0}</strong><span>Pending requests</span></div>
        <div><strong>{data?.summary.ready ?? 0}</strong><span>Ready to send</span></div>
        <div><strong>{(data?.summary.unmatched ?? 0) + (data?.summary.ambiguous ?? 0)}</strong><span>Need review</span></div>
      </section>

      <section className="notification-queue">
        <div className="admin-section-heading">
          <div>
            <h2>Private notification queue</h2>
            <p>Requester email addresses remain in Resend and are never shown here.</p>
          </div>
        </div>
        {loading && !data ? (
          <div className="admin-inline-empty"><LoaderCircle className="spin" size={16} /> Loading notification queue</div>
        ) : data?.queue.length ? (
          <div className="notification-list">
            {data.queue.map((item) => (
              <NotificationQueueRow
                key={item.segmentId}
                item={item}
                logos={logos}
                busy={busy}
                onDispatch={onDispatch}
              />
            ))}
          </div>
        ) : (
          <div className="admin-inline-empty"><Check size={16} /> No logo notifications are waiting</div>
        )}
      </section>

      <details className="manual-notification">
        <summary>Send a one-off availability email</summary>
        <LogoLiveNotificationForm
          busy={busy}
          logos={logos}
          onSubmit={onManualSubmit}
        />
      </details>
    </main>
  );
}

function NotificationQueueRow({
  item,
  logos,
  busy,
  onDispatch
}: {
  item: NotificationQueueItem;
  logos: Logo[];
  busy: boolean;
  onDispatch: (payload?: Record<string, unknown>) => Promise<boolean>;
}) {
  const [selectedSlug, setSelectedSlug] = useState(item.matches[0]?.slug ?? "");
  const readyMatch = item.status === "ready" ? item.matches[0] : null;

  return (
    <article className="notification-row">
      <div className="notification-request">
        <span className={`notification-status ${item.status}`}>
          {item.status === "ready" ? "Ready" : item.status === "ambiguous" ? "Review" : "Unmatched"}
        </span>
        <strong>{item.requestedName}</strong>
        <small>{item.requestKey}</small>
      </div>
      {readyMatch ? (
        <div className="notification-match">
          <span>Matched catalog entry</span>
          <strong>{readyMatch.name}</strong>
        </div>
      ) : (
        <label className="notification-match">
          <span>Choose the live catalog entry</span>
          <select value={selectedSlug} onChange={(event) => setSelectedSlug(event.target.value)}>
            <option value="">Select a logo</option>
            {logos.map((logo) => <option key={logo.slug} value={logo.slug}>{logo.name}</option>)}
          </select>
        </label>
      )}
      <button
        type="button"
        disabled={busy || (!readyMatch && !selectedSlug)}
        onClick={() => void onDispatch({
          segmentId: item.segmentId,
          logoSlug: readyMatch?.slug ?? selectedSlug
        })}
      >
        <Send size={14} /> Send now
      </button>
    </article>
  );
}

function LogoLiveNotificationForm({
  busy,
  logos,
  onSubmit
}: {
  busy: boolean;
  logos: Logo[];
  onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [slug, setSlug] = useState(logos[0]?.slug ?? "");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("https://awalogo.com/");
  const [submissionId, setSubmissionId] = useState("");
  const selected = logos.find((logo) => logo.slug === slug);

  useEffect(() => {
    if (!slug && logos[0]) setSlug(logos[0].slug);
  }, [logos, slug]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const sent = await onSubmit({
      institutionName: selected.name,
      recipientEmail,
      logoUrl,
      submissionId
    });
    if (sent) {
      setRecipientEmail("");
      setSubmissionId("");
    }
  }

  return (
    <section className="manual-notification-panel">
      <div className="admin-page-heading">
        <p className="admin-kicker">Publication email</p>
        <h1>Notify a requester</h1>
        <p className="admin-page-description">Send the one-time availability email after a requested logo is live on awalogo.</p>
      </div>
      <form className="admin-form-grid" onSubmit={submit}>
        <section className="admin-form-section">
          <h2>Live logo</h2>
          <div className="admin-fields two">
            <label>
              <span>Catalog entry</span>
              <select value={slug} onChange={(event) => setSlug(event.target.value)} required>
                {logos.map((logo) => <option key={logo.slug} value={logo.slug}>{logo.name}</option>)}
              </select>
            </label>
            <label>
              <span>Recipient email</span>
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                placeholder="requester@example.com"
                autoComplete="off"
              />
            </label>
            <label>
              <span>Public logo URL</span>
              <input
                type="url"
                required
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="https://awalogo.com/"
              />
            </label>
            <label>
              <span>Submission ID (optional)</span>
              <input
                value={submissionId}
                onChange={(event) => setSubmissionId(event.target.value)}
                placeholder="UUID from the request email"
              />
            </label>
          </div>
        </section>
        <div className="admin-submit-row">
          <span>Use the private recipient address from the original maintainer email.</span>
          <button disabled={busy || !selected} type="submit"><Send size={17} /> Send availability email</button>
        </div>
      </form>
    </section>
  );
}

function AddLogoForm({ busy, onSubmit }: { busy: boolean; onSubmit: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [manualSlug, setManualSlug] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData(event.currentTarget);
    const ok = await onSubmit({
      operation: "add-logo",
      name,
      slug,
      category: form.get("category"),
      aliases: String(form.get("aliases") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      website: form.get("website"),
      sourceUrl: form.get("sourceUrl"),
      sourceType: form.get("sourceType"),
      svgBase64: await fileToBase64(file)
    });
    if (ok) { event.currentTarget.reset(); setName(""); setSlug(""); setFile(null); }
  }

  return (
    <main className="admin-form-page">
      <div className="admin-page-heading"><p className="admin-kicker">New catalog entry</p><h1>Add a logo</h1></div>
      <form className="admin-form-grid" onSubmit={submit}>
        <section className="admin-form-section">
          <h2>Institution</h2>
          <div className="admin-fields two">
            <label><span>Name</span><input required value={name} onChange={(event) => { setName(event.target.value); if (!manualSlug) setSlug(slugify(event.target.value)); }} placeholder="Access Bank" /></label>
            <label><span>Slug</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => { setManualSlug(true); setSlug(event.target.value); }} placeholder="access-bank" /></label>
            <label><span>Category</span><select name="category" required>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Aliases</span><input name="aliases" placeholder="Access, Access Bank Plc" /></label>
          </div>
        </section>
        <section className="admin-form-section">
          <h2>Official source</h2>
          <div className="admin-fields two">
            <label><span>Website</span><input name="website" type="url" required placeholder="https://company.com" /></label>
            <label><span>Source URL</span><input name="sourceUrl" type="url" required placeholder="https://company.com/brand" /></label>
            <label><span>Source type</span><select name="sourceType" required>{sourceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
        </section>
        <section className="admin-form-section asset"><div><h2>Logo asset</h2><p>PNG and WebP derivatives are generated automatically.</p></div><UploadField file={file} onFile={setFile} /></section>
        <div className="admin-submit-row"><span>New entries are submitted as needs-review.</span><button disabled={busy || !file} type="submit"><GitFork size={17} /> Create pull request</button></div>
      </form>
    </main>
  );
}

function VariationManager({ logo, variations, busy, mutate }: { logo: Logo; variations: Variation[]; busy: boolean; mutate: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [variationId, setVariationId] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");

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
          <div>{variationPreview(logo.slug, variation.id) ? <img src={variationPreview(logo.slug, variation.id)!} alt="" /> : <ImagePlus size={20} />}</div>
          <span><strong>{variation.name}</strong><small>{variation.id}</small></span>
          <button aria-label={`Remove ${variation.name}`} title="Remove variation" onClick={() => { setConfirming(variation.id); setConfirmation(""); }}><Trash2 size={16} /></button>
        </article>
      ))}</div> : <div className="admin-inline-empty"><ImagePlus size={18} /> No variations added</div>}

      {adding ? <div className="admin-dialog-backdrop"><form className="admin-dialog" onSubmit={add}>
        <button className="admin-dialog-close" type="button" onClick={() => setAdding(false)} aria-label="Close"><X size={18} /></button>
        <p className="admin-kicker">{logo.name}</p><h2>Add variation</h2>
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
  return <div className="admin-dialog-backdrop"><div className="admin-dialog confirm"><div className="admin-danger-icon"><Trash2 size={19} /></div><h2>{title}</h2><p>Type <strong>{token}</strong> to confirm.</p><label><span>Confirmation</span><input autoFocus value={value} onChange={(event) => onChange(event.target.value)} /></label><div className="admin-dialog-actions"><button onClick={onCancel}>Cancel</button><button className="danger" disabled={busy || value !== token} onClick={onConfirm}>Remove in pull request</button></div></div></div>;
}
