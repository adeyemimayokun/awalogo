import type { VercelRequest } from "@vercel/node";
import { z } from "zod";
import { adminStore, adminStoreConfigured } from "./admin-store.js";
import { adminResources } from "./admin-resources.js";
import { listPendingPublications } from "./github.js";
export function dateRange(query: VercelRequest["query"]) {
  const today = new Date().toISOString().slice(0, 10);
  const days = Number(query.days ?? 30);
  const until = typeof query.until === "string" ? query.until : today;
  const since =
    typeof query.since === "string"
      ? query.since
      : new Date(Date.parse(until) - ((days || 30) - 1) * 86400000)
          .toISOString()
          .slice(0, 10);
  for (const d of [since, until])
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      !Number.isFinite(Date.parse(d)) ||
      new Date(d).toISOString().slice(0, 10) !== d
    )
      throw new Error("Invalid date range");
  const duration = (Date.parse(until) - Date.parse(since)) / 86400000 + 1;
  if (duration < 1 || duration > 366 || until > today)
    throw new Error(
      "Choose a date range of 1–366 days ending no later than today",
    );
  return {
    since,
    until,
    previousSince: new Date(Date.parse(since) - duration * 86400000)
      .toISOString()
      .slice(0, 10),
    previousUntil: new Date(Date.parse(since) - 86400000)
      .toISOString()
      .slice(0, 10),
  };
}
const trafficCache = new Map<string, { at: number; data: unknown }>();
async function traffic(since: string, until: string, by: string) {
  const token = process.env.ADMIN_ANALYTICS_VERCEL_TOKEN;
  const project = process.env.ADMIN_ANALYTICS_PROJECT_ID;
  if (!token || !project)
    return {
      state: "unconfigured",
      message:
        "Configure the server-side Vercel analytics token and project ID.",
    };
  const params = new URLSearchParams({
    projectId: project,
    since,
    until,
    by,
    limit: by === "day" ? "366" : "100",
    filter: "environment eq 'production'",
  });
  if (process.env.ADMIN_ANALYTICS_TEAM_ID)
    params.set("teamId", process.env.ADMIN_ANALYTICS_TEAM_ID);
  const cacheKey = params.toString();
  const cached = trafficCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 300000) return cached.data;
  try {
    const r = await fetch(
      `https://api.vercel.com/v1/query/web-analytics/visits/aggregate?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!r.ok)
      throw new Error(
        `Vercel analytics unavailable (${r.status}). Check access and the plan reporting window; no upgrade has been made.`,
      );
    const payload = (await r.json()) as { data?: unknown[] };
    if (!Array.isArray(payload.data))
      throw new Error("Unexpected analytics response");
    const data = {
      state: payload.data.length ? "ready" : "empty",
      rows: payload.data,
      updatedAt: new Date().toISOString(),
    };
    if (trafficCache.size > 100) trafficCache.clear();
    trafficCache.set(cacheKey, { at: Date.now(), data });
    return data;
  } catch (e) {
    return cached
      ? {
          ...(cached.data as object),
          state: "stale",
          message: "Refresh failed; showing the last successful result.",
        }
      : {
          state: "unavailable",
          message: e instanceof Error ? e.message : "Analytics unavailable",
        };
  }
}
async function stored(path: string) {
  if (!adminStoreConfigured())
    return {
      state: "unconfigured",
      message:
        "Configure the admin database and apply supabase/admin-dashboard.sql.",
    };
  try {
    const [table, queryString] = path.split("?");
    const params = new URLSearchParams(queryString);
    const limit = Math.min(10000, Number(params.get("limit")) || 1000);
    const rows: unknown[] = [];
    while (rows.length < limit) {
      const size = Math.min(1000, limit - rows.length);
      params.set("limit", String(size));
      params.set("offset", String(rows.length));
      const page = await adminStore<unknown[]>(table + "?" + params);
      rows.push(...page);
      if (page.length < size) break;
    }
    return {
      state: rows.length ? "ready" : "empty",
      rows,
      ...(rows.length === limit
        ? {
            message: `Showing the first ${limit.toLocaleString()} records. Narrow the date range for complete exports.`,
          }
        : {}),
    };
  } catch {
    return {
      state: "unavailable",
      message:
        "Database unavailable. Check credentials and the admin migration.",
    };
  }
}
export async function dashboardView(
  view: string,
  query: VercelRequest["query"],
  token?: string,
) {
  if (view === "resources")
    return { resources: adminResources(), catalogSource: "deployment-bundle" };
  if (view === "plugin")
    return stored(
      "admin_plugin_snapshots?select=*&order=observed_at.desc,recorded_at.desc&limit=100",
    );
  if (view === "reports")
    return stored("asset_reports?select=*&order=created_at.desc&limit=1000");
  if (view === "overview") {
    const [reports, publications, requests] = await Promise.all([
      stored(
        "asset_reports?select=status&status=in.(pending,in-review)&limit=1000",
      ),
      listPendingPublications(token)
        .then((rows) => ({ state: "ready", rows }))
        .catch(() => ({
          state: "unavailable",
          message: "Repository publication activity unavailable",
        })),
      stored(
        "asset_requests?select=status&status=in.(pending,in-review,needs-info,approved)&limit=1000",
      ),
    ]);
    return {
      reports,
      requests,
      publications,
      database: adminStoreConfigured() ? "configured" : "unconfigured",
      traffic: process.env.ADMIN_ANALYTICS_VERCEL_TOKEN
        ? "configured"
        : "unconfigured",
      productTracking:
        process.env.ENABLE_PRODUCT_ANALYTICS === "true"
          ? "enabled"
          : "disabled",
      resources: adminResources(),
    };
  }
  if (view === "analytics") {
    const range = dateRange(query);
    const groups = [
      "day",
      "requestPath",
      "referrerHostname",
      "country",
      "deviceType",
      "browserName",
    ];
    const [panels, previous, totals, previousTotals, product, legacy] =
      await Promise.all([
        Promise.all(groups.map((by) => traffic(range.since, range.until, by))),
        traffic(range.previousSince, range.previousUntil, "day"),
        traffic(range.since, range.until, "environment"),
        traffic(range.previousSince, range.previousUntil, "environment"),
        stored(
          `product_event_daily?select=*&day=gte.${range.previousSince}&day=lte.${range.until}&order=day.asc&limit=10000`,
        ),
        stored(
          "logo_download_totals?select=slug,downloads&order=downloads.desc&limit=10000",
        ),
      ]);
    return {
      range,
      traffic: Object.fromEntries(groups.map((g, i) => [g, panels[i]])),
      previous,
      totals,
      previousTotals,
      product,
      legacy,
      trackingEnabled: process.env.ENABLE_PRODUCT_ANALYTICS === "true",
    };
  }
  throw new Error("Unknown admin view");
}
const pluginSchema = z
  .object({
    count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    sourceUrl: z
      .string()
      .url()
      .refine((v) => {
        const u = new URL(v);
        return (
          u.protocol === "https:" &&
          u.hostname === "www.figma.com" &&
          /^\/community\/plugin\/1661356348996631383(?:\/|$)/.test(u.pathname)
        );
      }),
    observedAt: z
      .string()
      .datetime()
      .refine((v) => Date.parse(v) <= Date.now()),
  })
  .strict();
export async function dashboardMutation(
  view: string,
  body: unknown,
  login: string,
) {
  if (view === "plugin") {
    const b = pluginSchema.parse(body);
    await adminStore("admin_plugin_snapshots", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        count: b.count,
        source_url: b.sourceUrl,
        observed_at: b.observedAt,
        recorded_by: login,
      }),
    });
    return { ok: true };
  }
  if (view === "report-triage") {
    const b = z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "in-review", "resolved", "dismissed"]),
        note: z.string().trim().max(2000),
      })
      .strict()
      .parse(body);
    if (["resolved", "dismissed"].includes(b.status) && b.note.length < 5)
      throw new Error("A resolution note is required");
    await adminStore("rpc/triage_asset_report", {
      method: "POST",
      body: JSON.stringify({
        report_id: b.id,
        next_status: b.status,
        resolution: b.note,
        actor: login,
      }),
    });
    return { ok: true };
  }
  throw new Error("Unknown admin mutation");
}
