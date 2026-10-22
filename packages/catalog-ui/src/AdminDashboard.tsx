import { WorkspaceSelect, WorkspaceButton } from "./WorkspaceControls";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  filterKeys,
  filterResources,
  readFilters,
  valuesFor,
  writeFilters,
  type AdminResource,
  type ResourceFilters,
} from "../../admin/resources";
import { Landmark, Building2, Flag, ShieldCheck, ChevronRight, ArrowUpRight, FileText, Database, BarChart3, Activity, GitPullRequest } from "lucide-react";
import editorial from "../../../apps/web/src/v2-editorial.json";

type Row = Record<string, any>;
type Panel = {
  state: string;
  message?: string;
  rows?: Row[];
  updatedAt?: string;
};
export async function adminApi<T = Row>(
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Admin request failed");
  return result as T;
}
function useView(view: string) {
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    adminApi("/api/admin/catalog?view=" + view)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [view, revision]);
  return { data, error, reload: () => setRevision((v) => v + 1) };
}
function State({ panel }: { panel: Panel }) {
  return (
    <p className="ad-state" role="status">
      {panel.message ??
        (panel.state === "empty"
          ? "No data recorded for this period."
          : panel.state)}
    </p>
  );
}
function Heading({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <header className="ad-heading">
      <div>
        <p className="admin-kicker">Workspace</p>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      {action && <div className="ad-heading-action">{action}</div>}
    </header>
  );
}
function Loading({ error }: { error: string }) {
  return (
    <p role={error ? "alert" : "status"} className="ad-state">
      {error || "Loading workspace…"}
    </p>
  );
}
export function AdminOverview({ onAssets }: { onAssets: () => void }) {
  const { data, error, reload } = useView("overview");
  if (!data)
    return (
      <main className="ad-page">
        <Heading
          title="Overview"
          detail="Catalog coverage, review work, and publication activity."
        />
        <Loading error={error} />
        <button onClick={reload}>Retry</button>
      </main>
    );
  const resources = data.resources as AdminResource[];
  const count = (collection: string) =>
    new Set(
      resources.filter((r) => r.collection === collection).map((r) => r.slug),
    ).size;
  const collections = [
    { key: "financial", title: "Financial logos", detail: "Banks, fintechs, and financial institutions", icon: Landmark },
    { key: "company", title: "Independent companies", detail: "Brands across industries and markets", icon: Building2 },
    { key: "flag", title: "Country & territory flags", detail: "Country codes, regions, and available formats", icon: Flag },
  ];
  const reviewCount = resources.filter((r) => r.status === "needs-review").length;
  const preview = (collection: string) => {
    const seen = new Set<string>();
    return resources.filter((r) => {
      if (r.collection !== collection || !(r.preview || r.formats.find(f => f.url)?.url) || seen.has(r.slug)) return false;
      seen.add(r.slug); return true;
    }).slice(0, 3);
  };
  return (
    <main className="ad-page">
      <Heading title="Overview" detail="Your catalog, review work, and publication activity at a glance." action={<WorkspaceButton className="ad-primary-action" onClick={onAssets}>Browse assets <ArrowUpRight size={15} /></WorkspaceButton>} />
      <div className="ad-stats">
        {[...collections.map(c => ({label:c.title, value:count(c.key), icon:c.icon})), {label:"Artwork needing review",value:reviewCount,icon:ShieldCheck}].map(({label,value,icon:Icon}) => <button className="ad-metric" key={label} onClick={onAssets}><span className="ad-metric-icon"><Icon size={21}/></span><span>{label}</span><strong>{value.toLocaleString()}</strong><ChevronRight className="ad-metric-arrow" size={14}/></button>)}
      </div>
      <div className="ad-overview-grid">
        <div className="ad-overview-main">
          <section className="ad-panel">
            <div className="ad-panel-header"><div><h2>Catalog coverage</h2><p>All collections in one workspace.</p></div><button className="ad-text-action" onClick={onAssets}>View assets <ChevronRight size={13}/></button></div>
            <div className="ad-coverage-list">{collections.map(c => <button className="ad-coverage-row" key={c.key} onClick={onAssets}><span className="ad-coverage-previews">{preview(c.key).length ? preview(c.key).map(r => <span key={r.id}><img src={r.preview || r.formats.find(f => f.url)?.url} alt=""/></span>) : <span><c.icon size={20}/></span>}</span><span className="ad-coverage-copy"><strong>{c.title}</strong><small>{c.detail}</small></span><span className="ad-coverage-count">{count(c.key)}<br/><small>resources</small></span><ChevronRight size={14}/></button>)}</div>
          </section>
          <section className="ad-panel">
            <div className="ad-panel-header"><div><h2>Review workspace</h2><p>Keep your catalog accurate and up to date.</p></div></div>
            <div className="ad-review-grid">
              {[{title:"Artwork review",icon:ShieldCheck,value:reviewCount + " awaiting review",state:"Review queue"},{title:"Asset requests",icon:FileText,value:data.requests?.rows ? data.requests.rows.length + " unresolved" : "Connection required",state:data.requests?.state ?? "unavailable"},{title:"Asset reports",icon:Flag,value:data.reports?.rows ? data.reports.rows.length + " unresolved" : "Connection required",state:data.reports?.state ?? "unavailable"}].map(({title,icon:Icon,value,state}) => <div className="ad-review-item" key={title}><Icon size={19}/><h3>{title}</h3><p>{value}</p><span className="ad-status-label">{state}</span></div>)}
            </div>
          </section>
        </div>
        <div className="ad-overview-side">
          <section className="ad-panel"><div className="ad-panel-header"><div><h2>Publication activity</h2><p>Reviewed changes awaiting deployment.</p></div></div>
            {data.publications.state !== "ready" ? <State panel={data.publications}/> : data.publications.rows.length ? data.publications.rows.map((row:Row)=><p key={row.number}><a href={row.html_url} target="_blank" rel="noreferrer">#{row.number} {row.title}</a> · {row.publicationState}</p>) : <div className="ad-publication-empty"><GitPullRequest size={28}/><strong>No pending changes</strong><p>New catalog changes appear here when a review pull request is created.</p></div>}
          </section>
          <section className="ad-panel"><div className="ad-panel-header"><div><h2>Connections</h2><p>Availability of workspace integrations.</p></div></div><div className="ad-connection-list">{[{label:"Admin database",value:data.database,icon:Database},{label:"Website analytics",value:data.traffic,icon:BarChart3},{label:"Product tracking",value:data.productTracking,icon:Activity}].map(({label,value,icon:Icon})=><div className="ad-connection-row" key={label}><Icon size={16}/><span>{label}</span><span className={"ad-status-label " + (value === "configured" || value === "enabled" ? "connected" : "disabled")}>{value}</span></div>)}</div></section>
        </div>
      </div>
      <section className="ad-panel ad-workflow-panel"><div className="ad-workflow-intro"><h2>Reviewed publishing</h2><p>A clear path from edit to live.</p></div><div className="ad-workflow-steps">{[["Draft","Prepare your changes"],["Review","Approve the pull request"],["Deploy","Publish validated outputs"]].map(([title,detail],i)=><div className="ad-workflow-step" key={title}><b>{i+1}</b><span><strong>{title}</strong><small>{detail}</small></span></div>)}</div></section>
    </main>
  );
}

const filterLabels: Record<string, string> = {
  kind: "Resource type",
  collection: "Collection",
  format: "Available format",
  origin: "Origin / flag country",
  headquarters: "Headquarters",
  market: "Operating market",
  category: "Industry / category",
  status: "Verification",
  provenance: "Provenance",
  history: "Artwork period",
  distribution: "Distribution",
  region: "Flag region",
};
function ResourceFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const pointer = (event: PointerEvent) => {
      if (root.current?.open && !root.current.contains(event.target as Node))
        root.current.open = false;
    };
    document.addEventListener("pointerdown", pointer);
    return () => document.removeEventListener("pointerdown", pointer);
  }, []);
  return (
    <details
      className="ad-filter-group"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && root.current) {
          root.current.open = false;
          root.current.querySelector<HTMLElement>("summary")?.focus();
        }
      }}
    >
      <summary>
        {label}
        <span>{selected.length || "All"}</span>
      </summary>
      <div className="ad-filter-options">
        {options.length > 8 ? (
          <label className="ad-filter-search">
            <span className="admin-visually-hidden">
              Search {label.toLowerCase()}
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={"Search " + label.toLowerCase()}
            />
          </label>
        ) : null}
        <div className="ad-filter-checkboxes">
          {options
            .filter((value) =>
              value.toLowerCase().includes(query.toLowerCase()),
            )
            .map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={selected.includes(value)}
                  onChange={() =>
                    onChange(
                      selected.includes(value)
                        ? selected.filter((item) => item !== value)
                        : [...selected, value],
                    )
                  }
                />
                <span>
                  {value === "unknown" ? "Unknown" : value.replaceAll("-", " ")}
                </span>
              </label>
            ))}
        </div>
        {selected.length ? (
          <button type="button" onClick={() => onChange([])}>
            Clear selection
          </button>
        ) : null}
      </div>
    </details>
  );
}
export function AdminAssets({
  onLegacy,
}: {
  onLegacy: (slug: string) => void;
}) {
  const { data, error, reload } = useView("resources");
  const [filters, setFilters] = useState<ResourceFilters>(() =>
    readFilters(location.search),
  );
  const [selected, setSelected] = useState<AdminResource | null>(null);
  useEffect(() => {
    const pop = () => setFilters(readFilters(location.search));
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  function change(patch: ResourceFilters) {
    const next = { ...filters, ...patch, page: patch.page ?? 1 };
    setFilters(next);
    history.replaceState(
      null,
      "",
      `${location.pathname}?${writeFilters(next, location.search)}`,
    );
  }
  const resources = (data?.resources ?? []) as AdminResource[];
  const matches = useMemo(
    () => filterResources(resources, filters),
    [data, filters],
  );
  const pages = Math.max(1, Math.ceil(matches.length / 25));
  const page = Math.min(filters.page ?? 1, pages);
  return (
    <main className="ad-page">
      <Heading
        title="Assets"
        detail="Browse all deployed artwork. Changes create reviewable pull requests."
      />
      <div className="ad-toolbar">
        <label>
          Search
          <input
            value={filters.query ?? ""}
            onChange={(e) => change({ query: e.target.value })}
            placeholder="Name, alias, slug, or resource ID"
          />
        </label>
        <label>
          Sort
          <WorkspaceSelect
            value={filters.sort ?? "name"}
            onChange={(e) => change({ sort: e.target.value })}
          >
            <option value="name">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </WorkspaceSelect>
        </label>
        <button
          onClick={() => {
            setFilters({});
            history.replaceState(
              null,
              "",
              location.pathname + "?section=assets",
            );
          }}
        >
          Clear all
        </button>
      </div>
      <details className="ad-filter-panel">
        <summary>
          Filter assets · {matches.length} artwork record
          {matches.length === 1 ? "" : "s"}
        </summary>
        <p>
          Choose one or more values in each filter. Your selections appear
          below.
        </p>
        <div className="ad-filters">
          {filterKeys.map((key) => (
            <ResourceFilter
              key={key}
              label={filterLabels[key]}
              options={[
                ...new Set(resources.flatMap((r) => valuesFor(r, key))),
              ].sort()}
              selected={filters[key] ?? []}
              onChange={(values) => change({ [key]: values })}
            />
          ))}
        </div>
      </details>
      <div className="ad-chips">
        {filterKeys.flatMap((key) =>
          (filters[key] ?? []).map((value) => (
            <button
              key={key + value}
              aria-label={`Remove ${filterLabels[key]} ${value}`}
              onClick={() =>
                change({ [key]: filters[key]!.filter((v) => v !== value) })
              }
            >
              {filterLabels[key]}: {value} ×
            </button>
          )),
        )}
      </div>
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <p>
            {matches.length} matching artwork records ·{" "}
            {new Set(matches.map((r) => r.collection + ":" + r.slug)).size}{" "}
            resources · deployment snapshot
          </p>
          <div className="ad-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Collection / ID</th>
                  <th>Formats</th>
                  <th>Country / markets</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {matches.slice((page - 1) * 25, page * 25).map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="ad-asset-cell">
                        <span className="ad-asset-thumb">
                          {r.formats.find((f) => f.url) ? (
                            <img
                              src={
                                r.formats.find((f) => f.type === "png" && f.url)
                                  ?.url ?? r.formats.find((f) => f.url)?.url
                              }
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <span aria-hidden="true">
                              {r.kind === "flag" ? "⚑" : "◇"}
                            </span>
                          )}
                        </span>
                        <div>
                          <strong>{r.name}</strong>
                          <small>
                            {r.history} · {r.variation}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {r.collection}
                      <small className="ad-resource-id" title={r.id}>
                        {r.id}
                      </small>
                    </td>
                    <td>
                      {r.formats.map((f) => f.type.toUpperCase()).join(" · ")}
                    </td>
                    <td>
                      {r.origin ?? "Unknown"}
                      <small>
                        Markets: {r.markets.join(", ") || "Unknown"}
                      </small>
                    </td>
                    <td>
                      <span className="ad-status">
                        {r.status.replaceAll("-", " ")}
                      </span>
                      <small>{r.provenance}</small>
                    </td>
                    <td>
                      <button
                        className="ad-inspect"
                        onClick={() => setSelected(r)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!matches.length ? <p>No assets match these filters.</p> : null}
          <nav className="ad-pagination" aria-label="Asset pages">
            <button
              disabled={page <= 1}
              onClick={() => change({ page: page - 1 })}
            >
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => change({ page: page + 1 })}
            >
              Next
            </button>
          </nav>
        </>
      )}
      {selected ? (
        <ResourceEditor
          key={selected.id}
          resource={selected}
          onClose={() => setSelected(null)}
          onLegacy={onLegacy}
        />
      ) : null}
      <button onClick={reload}>Refresh deployed catalog</button>
    </main>
  );
}
function ResourceEditor({
  resource: r,
  onClose,
  onLegacy,
}: {
  resource: AdminResource;
  onClose: () => void;
  onLegacy: (slug: string) => void;
}) {
  const [operation, setOperation] = useState(
    r.collection === "flag" ? "edit-flag" : "edit",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Row | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const items = Array.from(
          drawerRef.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)",
          ) ?? [],
        ).filter((el) => el.getClientRects().length);
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      previousFocus?.focus();
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const file = form.get("file") as File;
      let artwork;
      if (file?.size) {
        if (file.size > 2000000) throw new Error("Artwork must be under 2 MB");
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (const b of bytes) binary += String.fromCharCode(b);
        artwork = {
          base64: btoa(binary),
          type: file.name.split(".").pop()?.replace("jpg", "jpeg"),
        };
      }
      const body: Row = {
        collection: r.collection,
        slug: r.slug,
        variation: r.variation,
        operation,
        notes: form.get("notes"),
        confirmation: form.get("confirmation") ?? "",
      };
      if (!["remove", "archive"].includes(operation)) {
        body.name = form.get("name");
        body.sourceUrl = form.get("sourceUrl");
        if (r.collection === "flag") {
          delete body.sourceUrl;
          body.region = form.get("region");
        } else if (r.history !== "historical") {
          body.aliases = String(form.get("aliases") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          body.origin = form.get("origin") || null;
          body.headquarters = form.get("headquarters") || null;
          body.markets = String(form.get("markets") ?? "")
            .split(",")
            .map((v) => v.trim().toUpperCase())
            .filter(Boolean);
          body.sourceType = form.get("sourceType");
          body.website = form.get("website");
          body.industry = form.get("industry");
        }
        if (artwork) body.file = artwork;
      }
      setResult(await adminApi("/api/admin/mutate?view=resource", body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to prepare change");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="ad-drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={drawerRef}
        className="ad-editor ad-resource-editor"
        role="dialog"
        aria-modal="true"
        aria-label={`Maintain ${r.name}`}
      >
        <header>
          <h2>{r.name}</h2>
          <button onClick={onClose}>Close</button>
        </header>
        {r.formats.some((f) => f.url) ? (
          <div className="ad-resource-preview">
            <img
              src={
                r.formats.find((f) => f.type === "png" && f.url)?.url ??
                r.formats.find((f) => f.url)?.url
              }
              alt={r.name}
            />
            <span>
              {r.history === "historical"
                ? "Historical artwork"
                : "Current artwork"}{" "}
              · {r.variation}
            </span>
          </div>
        ) : null}
        <dl className="ad-facts">
          <div>
            <dt>Resource ID</dt>
            <dd>{r.id}</dd>
          </div>
          <div>
            <dt>Origin / headquarters</dt>
            <dd>
              {r.origin ?? "Unknown"} / {r.headquarters ?? "Unknown"}
            </dd>
          </div>
          <div>
            <dt>Distribution</dt>
            <dd>{r.distribution.join(", ")}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                Source evidence
              </a>
              {r.license ? ` · ${r.license} · standardized proportions` : null}
            </dd>
          </div>
        </dl>
        <div className="ad-files">
          {r.formats
            .filter((f) => f.url)
            .map((f) => (
              <a key={f.type} href={f.url} target="_blank" rel="noreferrer">
                Preview {f.type.toUpperCase()}
              </a>
            ))}
        </div>
        {r.collection === "financial" ? (
          <>
            <p>
              Financial-logo maintenance uses the existing validated catalog
              workflow.
            </p>
            <button onClick={() => onLegacy(r.slug)}>
              Open financial-logo editor
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <label>
              Action
              <WorkspaceSelect
                value={operation}
                onChange={(e) => {
                  setOperation(e.target.value);
                  setResult(null);
                }}
              >
                {r.actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </WorkspaceSelect>
            </label>
            {!["archive", "remove"].includes(operation) ? (
              <>
                <label>
                  Name
                  <input
                    name="name"
                    required
                    defaultValue={
                      r.history === "historical"
                        ? r.name.split(" / ").slice(1).join(" / ")
                        : r.name.split(" / ")[0]
                    }
                  />
                </label>
                {r.collection === "flag" ? (
                  <>
                    <label>
                      Region
                      <input name="region" required defaultValue={r.region} />
                    </label>
                    <p>
                      Artwork corrections use the pinned flag-icons@7.6.0
                      importer and retain the MIT license.
                    </p>
                  </>
                ) : (
                  <>
                    <label>
                      Source URL
                      <input
                        name="sourceUrl"
                        required
                        type="url"
                        defaultValue={r.sourceUrl}
                      />
                    </label>
                    {r.history !== "historical" ? (
                      <>
                        <label>
                          Website
                          <input
                            name="website"
                            type="url"
                            required
                            defaultValue={r.website}
                          />
                        </label>
                        <label>
                          Source type
                          <WorkspaceSelect name="sourceType" defaultValue={r.provenance}>
                            {[
                              "official-website",
                              "official-brand-page",
                              "annual-report",
                              "verified-pdf",
                              "community-catalog",
                            ].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </WorkspaceSelect>
                        </label>
                        <label>
                          Industry
                          <WorkspaceSelect
                            name="industry"
                            defaultValue={r.categories[0]}
                          >
                            {[
                              "financial-services",
                              "technology",
                              "telecommunications",
                              "retail-commerce",
                              "food-beverages",
                              "transport-logistics",
                              "energy-utilities",
                              "healthcare",
                              "education",
                              "media-entertainment",
                              "manufacturing-consumer-goods",
                              "real-estate-construction",
                              "hospitality-leisure",
                            ].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </WorkspaceSelect>
                        </label>
                        <label>
                          Aliases (comma separated)
                          <input
                            name="aliases"
                            defaultValue={r.aliases.join(", ")}
                          />
                        </label>
                        <label>
                          Origin (two-letter code; blank if unknown)
                          <input
                            name="origin"
                            pattern="[A-Z]{2}"
                            defaultValue={r.origin ?? ""}
                          />
                        </label>
                        <label>
                          Headquarters (two-letter code; blank if unknown)
                          <input
                            name="headquarters"
                            pattern="[A-Z]{2}"
                            defaultValue={r.headquarters ?? ""}
                          />
                        </label>
                        <label>
                          Operating markets (comma separated codes)
                          <input
                            name="markets"
                            required
                            defaultValue={r.markets.join(", ")}
                          />
                        </label>
                      </>
                    ) : null}
                    <label>
                      Replacement artwork (up to 2 MB)
                      <input
                        name="file"
                        type="file"
                        accept=".svg,.png,.webp,.jpg,.jpeg"
                        required={operation === "replace"}
                      />
                    </label>
                  </>
                )}
              </>
            ) : (
              <label>
                Type {r.slug} to confirm
                <input name="confirmation" required pattern={r.slug} />
              </label>
            )}
            <label>
              Review / resolution notes
              <textarea name="notes" minLength={10} maxLength={2000} required />
            </label>
            <WorkspaceButton type="submit" className="ad-primary-action" disabled={busy}>
              {busy ? "Preparing…" : "Create review pull request"}
            </WorkspaceButton>
          </form>
        )}
        {error ? <p role="alert">{error}</p> : null}
        {result ? (
          <p role="status">
            {result.localPreview
              ? "Local sandbox prepared."
              : "Pending review and deployment. "}
            {result.pullRequest ? (
              <a href={result.pullRequest.url} target="_blank" rel="noreferrer">
                Review PR #{result.pullRequest.number}
              </a>
            ) : null}
          </p>
        ) : null}
      </section>
    </div>
  );
}
export function AdminReports() {
  const { data, error, reload } = useView("reports");
  const [message, setMessage] = useState("");
  async function triage(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setMessage("Saving…");
    try {
      await adminApi("/api/admin/mutate?view=report-triage", {
        id,
        status: f.get("status"),
        note: f.get("note"),
      });
      setMessage("Report updated.");
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed");
    }
  }
  return (
    <section className="ad-page">
      <Heading
        title="Artwork reports"
        detail="Review reported artwork issues and record resolution decisions."
      />
      <p>
        Reports remain private. Resolving a report does not publish an asset
        correction.
      </p>
      {message ? <p role="status">{message}</p> : null}
      {!data ? (
        <Loading error={error} />
      ) : data.rows?.length ? (
        data.rows.map((r: Row) => (
          <article className="ad-report" key={r.submission_id}>
            <h3>
              {r.slug} / {r.variation} · {r.format}
            </h3>
            <p>
              {r.reason} · {r.created_at}
            </p>
            <p>{r.note}</p>
            {r.official_source ? (
              <a href={r.official_source} target="_blank" rel="noreferrer">
                Suggested source
              </a>
            ) : null}
            <form onSubmit={(e) => triage(e, r.submission_id)}>
              <label>
                Status
                <WorkspaceSelect name="status" defaultValue={r.status}>
                  {["pending", "in-review", "resolved", "dismissed"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </WorkspaceSelect>
              </label>
              <label>
                Resolution notes
                <textarea
                  name="note"
                  defaultValue={r.resolution_note}
                  maxLength={2000}
                />
              </label>
              <button>Save triage decision</button>
            </form>
          </article>
        ))
      ) : (
        <State panel={data as Panel} />
      )}
    </section>
  );
}
export function AdminPlugin() {
  const { data, error, reload } = useView("plugin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await adminApi("/api/admin/mutate?view=plugin", {
        count: Number(f.get("count")),
        sourceUrl: f.get("source"),
        observedAt: new Date(String(f.get("observed"))).toISOString(),
      });
      setMessage("Snapshot recorded.");
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Snapshot failed");
    } finally {
      setBusy(false);
    }
  }
  const latest = data?.rows?.[0];
  return (
    <main className="ad-page ad-plugin-page">
      <Heading
        title="Plugin"
        detail="Published Community count, recorded with source evidence."
      />
      <div className="ad-plugin-grid"><section className="ad-panel"><div className="ad-panel-header"><div><h2>Published install count</h2><p>Manually updated from the Community listing.</p></div></div>
      {!data ? (
        <Loading error={error} />
      ) : latest ? (
        <section>
          <p>
            Manually updated ·{" "}
            {Date.now() - Date.parse(latest.observed_at) > 7 * 86400000
              ? "Stale (older than seven days)"
              : "Recent snapshot"}
          </p>
          <strong className="ad-big-number">
            {Number(latest.count).toLocaleString()}
          </strong>
          <p>
            Published count observed{" "}
            {new Date(latest.observed_at).toLocaleString()} · recorded by @
            {latest.recorded_by}
          </p>
          <a href={latest.source_url} target="_blank" rel="noreferrer">
            Community source
          </a>
        </section>
      ) : (
        <div className="ad-plugin-empty"><strong className="ad-big-number">—</strong><p>No snapshot recorded</p><State panel={data as Panel} /></div>
      )}
      </section><form onSubmit={submit} className="ad-editor">
        <h2>Record published count</h2>
        <p>
          Copy the count from the Community listing. This is not active plugin
          usage or website downloads.
        </p>
        <label>
          Count
          <input name="count" type="number" min="0" step="1" required />
        </label>
        <label>
          Source
          <input
            name="source"
            type="url"
            required
            defaultValue="https://www.figma.com/community/plugin/1661356348996631383/awalogo"
          />
        </label>
        <label>
          Observed at (local time)
          <input name="observed" type="datetime-local" required />
        </label>
        <button disabled={busy}>
          {busy ? "Recording…" : "Record snapshot"}
        </button>
        <p role="status">{message}</p>
      </form>
      </div>{data?.rows?.length ? (
        <section>
          <h2>Snapshot audit history</h2>
          {data.rows.map((r: Row) => (
            <p key={r.id}>
              {Number(r.count).toLocaleString()} · {r.observed_at} · @
              {r.recorded_by}
            </p>
          ))}
        </section>
      ) : null}
    </main>
  );
}
function csvCell(value: unknown) {
  const text = String(value ?? "");
  return (
    '"' +
    (/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') +
    '"'
  );
}
function exportCsv(data: Row) {
  const lines = [
    ["section", "dimension", "value", "pageviews / count", "visitors"],
  ];
  for (const [group, p] of Object.entries(data.traffic) as [string, Panel][])
    for (const row of p.rows ?? [])
      lines.push([
        "traffic",
        group,
        String(row[group] ?? row.timestamp ?? ""),
        String(row.pageviews ?? ""),
        String(row.visitors ?? ""),
      ]);
  for (const r of (data.product.rows ?? []).filter(
    (row: Row) => row.day >= data.range.since,
  ))
    lines.push([
      "product",
      r.event,
      [r.day, r.resource, r.format, r.detail].join(" / "),
      String(r.count),
      "",
    ]);
  const blob = new Blob(
    [lines.map((row) => row.map(csvCell).join(",")).join("\r\n")],
    { type: "text/csv" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `awalogo-analytics-${data.range.since}-${data.range.until}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Breakdown({
  title,
  panel,
  dimension,
}: {
  title: string;
  panel: Panel;
  dimension: string;
}) {
  const max = Math.max(
    1,
    ...(panel.rows ?? []).map((r) => Number(r.pageviews ?? r.count ?? 0)),
  );
  return (
    <section>
      <h2>{title}</h2>
      {!["ready", "empty"].includes(panel.state) ? (
        <State panel={{state:panel.state, message:panel.state === "unconfigured" ? "Awaiting analytics connection" : panel.message}} />
      ) : null}
      {panel.state === "empty" ? <State panel={panel} /> : null}
      {panel.rows?.map((r, i) => (
        <div className="ad-bar-row" key={i}>
          <span>{String(r[dimension] ?? r.timestamp ?? "Unknown")}</span>
          <meter
            min={0}
            max={max}
            value={Number(r.pageviews ?? r.count ?? 0)}
          />
          <strong>
            {Number(r.pageviews ?? r.count ?? 0).toLocaleString()}
          </strong>
        </div>
      ))}
    </section>
  );
}
export function AdminAnalytics() {
  const [range, setRange] = useState("days=30");
  const { data, error, reload } = useView("analytics&" + range);
  const traffic = data?.traffic?.day as Panel | undefined;
  const total = traffic?.rows?.reduce((n, r) => n + Number(r.pageviews), 0);
  const before = data?.previous?.rows?.reduce(
    (n: number, r: Row) => n + Number(r.pageviews),
    0,
  );
  return (
    <main className="ad-page">
      <Heading
        title="Analytics"
        detail="Production website traffic and aggregate product activity. Dates use UTC."
      />
      <div className="ad-toolbar">
        {[7, 30, 90].map((days) => (
          <button
            key={days}
            aria-pressed={range === `days=${days}`}
            onClick={() => setRange(`days=${days}`)}
          >
            {days} days
          </button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setRange(
              new URLSearchParams({
                since: String(f.get("since")),
                until: String(f.get("until")),
              }).toString(),
            );
          }}
        >
          <label>
            From
            <input name="since" type="date" required />
          </label>
          <label>
            To
            <input name="until" type="date" required />
          </label>
          <button>Apply dates</button>
        </form>
        <button onClick={reload}>Refresh</button>
        <button disabled={!data} onClick={() => data && exportCsv(data)}>
          Export CSV
        </button>
      </div>
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <p>
            {data.range.since} through {data.range.until}. Provider retention
            limits apply; unavailable periods are labeled.
          </p>
          {data.traffic.day.state === "unconfigured" && <div className="ad-integration-notice" role="status"><BarChart3 size={19}/><div><strong>Website analytics is not connected</strong><p>{data.traffic.day.message}</p></div></div>}
          <div className="ad-stats">
            <div>
              <span>Pageviews</span>
              <strong>
                {total === undefined ? "—" : total.toLocaleString()}
              </strong>
              <small>
                {before === undefined
                  ? "Comparison unavailable"
                  : before === 0
                    ? "No previous-period baseline"
                    : `${((((total ?? 0) - before) / before) * 100).toFixed(1)}% vs previous period`}
              </small>
            </div>
            <div>
              <span>Visitors</span>
              <strong>
                {data.totals?.rows
                  ? data.totals.rows
                      .reduce((n: number, r: Row) => n + Number(r.visitors), 0)
                      .toLocaleString()
                  : "—"}
              </strong>
              <small>
                Unique visitors reported by Vercel for the selected period.
              </small>
            </div>
          </div>
          <div className="ad-columns">
            {[
              ["day", "Daily pageviews"],
              ["requestPath", "Top pages"],
              ["referrerHostname", "Referrers"],
              ["country", "Countries"],
              ["deviceType", "Devices"],
              ["browserName", "Browsers"],
            ].map(([dimension, title]) => (
              <Breakdown
                key={dimension}
                title={title}
                dimension={dimension}
                panel={data.traffic[dimension]}
              />
            ))}
          </div>
          <section>
            <h2>Product activity</h2>
            {data.product.message && data.product.rows ? (
              <p role="status">{data.product.message}</p>
            ) : null}
            <p>
              {data.trackingEnabled
                ? "Collection enabled on the server."
                : "Collection disabled on the server."}{" "}
              New events begin at activation; no historical backfill. Counts
              describe prepared downloads, not confirmed disk saves.
            </p>
            {data.product.rows ? (
              <div className="ad-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Event</th>
                      <th>Resource</th>
                      <th>Format / detail</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.product.rows
                      .filter((r: Row) => r.day >= data.range.since)
                      .map((r: Row, i: number) => (
                        <tr key={i}>
                          <td>{r.day}</td>
                          <td>{r.event}</td>
                          <td>{r.resource || "—"}</td>
                          <td>
                            {r.format} {r.detail}
                          </td>
                          <td>{r.count}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <State panel={data.product} />
            )}
          </section>
          <section>
            <h2>Legacy download demand</h2>
            <p>
              All-time, deduplicated company popularity totals. These are
              separate from product download events.
            </p>
            {data.legacy.rows ? (
              data.legacy.rows.slice(0, 20).map((r: Row) => (
                <p key={r.slug}>
                  {r.slug}: {r.downloads}
                </p>
              ))
            ) : (
              <State panel={data.legacy} />
            )}
          </section>
        </>
      )}
    </main>
  );
}
export function AdminV2Editorial() {
  type Editorial = typeof editorial;
  const [draft, setDraft] = useState<Editorial>(() =>
    structuredClone(editorial),
  );
  const [kind, setKind] = useState<"updates" | "changelog">("updates");
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState<Editorial | null>(null);
  const update = draft.updates[index];
  const release = draft.changelog[index];
  function patchUpdate(patch: Partial<Editorial["updates"][number]>) {
    setDraft((current) => ({
      ...current,
      updates: current.updates.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
    setResult(null);
  }
  function patchRelease(patch: Partial<Editorial["changelog"][number]>) {
    setDraft((current) => ({
      ...current,
      changelog: current.changelog.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
    setResult(null);
  }
  function addEntry() {
    const date = new Date().toISOString().slice(0, 10);
    if (kind === "updates") {
      setIndex(draft.updates.length);
      setDraft((current) => ({
        ...current,
        updates: [
          ...current.updates,
          {
            id: `v2-update-${crypto.randomUUID().slice(0, 8)}`,
            title: "",
            summary: "",
            published_at: date,
            action_label: "Browse assets",
            action_href: "/v2",
            status: "draft",
          },
        ],
      }));
    } else {
      setIndex(draft.changelog.length);
      setDraft((current) => ({
        ...current,
        changelog: [
          ...current.changelog,
          {
            version: `V2 preview / ${date}`,
            date,
            title: "",
            status: "draft",
            changes: [""],
          },
        ],
      }));
    }
    setResult(null);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await adminApi("/api/admin/mutate?view=resource", {
          collection: "editorial",
          slug: "v2-notes",
          operation: "save-editorial",
          notes: "Update the separately maintained V2 preview editorial feed.",
          editorial: {
            ...draft,
            changelog: draft.changelog.map((release) => ({
              ...release,
              changes: release.changes
                .map((note) => note.trim())
                .filter(Boolean),
            })),
          },
        }),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not prepare the editorial change.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="ad-page ad-editorial-page">
      <Heading
        title="V2 preview updates"
        detail="Maintain preview announcements and release notes. Changes go live after review and deployment."
      />
      <div className="ad-editorial-toolbar">
        <div className="ad-editorial-tabs" aria-label="V2 editorial content">
          <button
            aria-pressed={kind === "updates"}
            onClick={() => {
              setKind("updates");
              setIndex(0);
            }}
          >
            Announcements <span>{draft.updates.length}</span>
          </button>
          <button
            aria-pressed={kind === "changelog"}
            onClick={() => {
              setKind("changelog");
              setIndex(0);
            }}
          >
            Release notes <span>{draft.changelog.length}</span>
          </button>
        </div>
        <button onClick={addEntry}>
          Add {kind === "updates" ? "announcement" : "release"}
        </button>
      </div>
      {error ? (
        <p className="admin-inline-message error" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <p className="admin-inline-message success" role="status">
          {result.localPreview ? (
            "Local draft prepared."
          ) : (
            <a href={result.pullRequest.url} target="_blank" rel="noreferrer">
              Review PR #{result.pullRequest.number} · Pending publication
            </a>
          )}
        </p>
      ) : null}
      {removed ? (
        <p className="ad-editorial-undo" role="status">
          Entry removed from draft.{" "}
          <button
            onClick={() => {
              setDraft(removed);
              setRemoved(null);
              setIndex(0);
            }}
          >
            Undo
          </button>
        </p>
      ) : null}
      <div className="ad-editorial-layout">
        <nav
          className="ad-editorial-index"
          aria-label={kind === "updates" ? "Announcements" : "Release notes"}
        >
          {draft[kind].map((row, i) => (
            <button
              key={"id" in row ? row.id : row.version + "-" + i}
              aria-current={index === i ? "true" : undefined}
              onClick={() => {
                setIndex(i);
                setError("");
              }}
            >
              <strong>{row.title || "Untitled draft"}</strong>
              <small>
                {row.status === "published" ? "Published" : "Draft"} ·{" "}
                {"published_at" in row ? row.published_at : row.date}
              </small>
            </button>
          ))}
          {!draft[kind].length ? (
            <p>
              No {kind === "updates" ? "announcements" : "release notes"} yet.
            </p>
          ) : null}
        </nav>
        <form className="ad-editorial-form" onSubmit={save}>
          {kind === "updates" && update ? (
            <>
              <div className="ad-form-heading">
                <h2>Announcement details</h2>
                <span className="ad-status">{update.status}</span>
              </div>
              <label>
                Title
                <input
                  value={update.title}
                  onChange={(e) => patchUpdate({ title: e.target.value })}
                  required
                  minLength={2}
                />
              </label>
              <label>
                Summary
                <textarea
                  value={update.summary}
                  onChange={(e) => patchUpdate({ summary: e.target.value })}
                  required
                  minLength={10}
                  rows={5}
                />
                <small>
                  Use {"{companyCount}"} or {"{flagCount}"} to keep published
                  collection totals current.
                </small>
              </label>
              <div className="ad-form-two">
                <label>
                  Publication date
                  <input
                    type="date"
                    value={update.published_at}
                    onChange={(e) =>
                      patchUpdate({ published_at: e.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Visibility
                  <WorkspaceSelect
                    value={update.status}
                    onChange={(e) => patchUpdate({ status: e.target.value })}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </WorkspaceSelect>
                </label>
              </div>
              <div className="ad-form-two">
                <label>
                  Link label
                  <input
                    value={update.action_label}
                    onChange={(e) =>
                      patchUpdate({ action_label: e.target.value })
                    }
                  />
                </label>
                <label>
                  Preview link
                  <input
                    value={update.action_href}
                    onChange={(e) =>
                      patchUpdate({ action_href: e.target.value })
                    }
                    required
                    pattern="/v2.*"
                  />
                </label>
              </div>
            </>
          ) : kind === "changelog" && release ? (
            <>
              <div className="ad-form-heading">
                <h2>Release details</h2>
                <span className="ad-status">{release.status}</span>
              </div>
              <label>
                Release title
                <input
                  value={release.title}
                  onChange={(e) => patchRelease({ title: e.target.value })}
                  required
                  minLength={2}
                />
              </label>
              <div className="ad-form-two">
                <label>
                  Version / preview label
                  <input
                    value={release.version}
                    onChange={(e) => patchRelease({ version: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Release date
                  <input
                    type="date"
                    value={release.date}
                    onChange={(e) => patchRelease({ date: e.target.value })}
                    required
                  />
                </label>
              </div>
              <label>
                Visibility
                <WorkspaceSelect
                  value={release.status}
                  onChange={(e) => patchRelease({ status: e.target.value })}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </WorkspaceSelect>
              </label>
              <label>
                Release notes
                <textarea
                  value={release.changes.join("\n")}
                  onChange={(e) =>
                    patchRelease({ changes: e.target.value.split("\n") })
                  }
                  required
                  rows={10}
                />
                <small>Write one change per line.</small>
              </label>
            </>
          ) : (
            <p>Select an entry or add a new draft.</p>
          )}
          <footer className="ad-form-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Preparing…" : "Create review pull request"}
            </button>
            {draft[kind][index] ? (
              <button
                type="button"
                className="ad-remove-entry"
                onClick={() => {
                  setRemoved(structuredClone(draft));
                  setDraft((current) =>
                    kind === "updates"
                      ? {
                          ...current,
                          updates: current.updates.filter(
                            (_, i) => i !== index,
                          ),
                        }
                      : {
                          ...current,
                          changelog: current.changelog.filter(
                            (_, i) => i !== index,
                          ),
                        },
                  );
                  setIndex(0);
                  setResult(null);
                }}
              >
                Remove from draft
              </button>
            ) : null}
          </footer>
        </form>
      </div>
    </main>
  );
}
