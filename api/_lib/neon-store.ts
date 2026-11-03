import { Pool, types } from "pg";
import { attachDatabasePool } from "@vercel/functions";

const tables = {
  admin_session_revocations: "token_hash,expires_at",
  asset_requests: "submission_id,brand_name,website,category,contact_email,asset_url,notify_when_available,status,tracking_token_hash,github_issue_number,created_at,updated_at",
  asset_reports: "submission_id,slug,variation,format,reason,note,official_source,status,resolution_note,updated_by,created_at,updated_at",
  admin_plugin_snapshots: "id,count,source_url,observed_at,recorded_at,recorded_by",
  product_event_daily: "day,event,resource,format,detail,count",
  logo_download_totals: "slug,downloads",
} as const;
const procedures = {
  revoke_admin_session: ["session_hash", "session_expiry"],
  record_logo_downloads: ["requested_slugs", "network_key"],
  record_product_event: ["event_id", "event_name", "resource_id", "event_format", "event_detail"],
  triage_asset_report: ["report_id", "next_status", "resolution", "actor"],
} as const;

let pool: Pool | undefined;
let connection: string | undefined;

export function neonConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function database() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("PostgreSQL is not configured");
  if (!pool || connection !== url) {
    if (pool) void pool.end().catch(() => undefined);
    const connectionUrl = new URL(url);
    if (connectionUrl.searchParams.get("sslmode") === "require") connectionUrl.searchParams.set("sslmode", "verify-full");
    pool = new Pool({
      connectionString: connectionUrl.toString(), max: 3, idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000, statement_timeout: 10000,
      // DATE is a calendar day, not local midnight (which can shift in UTC).
      types: { getTypeParser: (oid, format) => oid === 1082 ? (value: string) => value : types.getTypeParser(oid, format) },
    });
    // Idle connections must not keep a Fluid Compute invocation alive.
    attachDatabasePool(pool);
    pool.on("error", () => console.error("Idle PostgreSQL connection failed"));
    connection = url;
  }
  return pool;
}

// Only the application's existing, server-generated store operations are supported.
// Identifiers are allowlisted; every value is sent separately as a SQL parameter.
export function compileStoreQuery(path: string, init: RequestInit = {}) {
  const [table, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  const method = init.method ?? "GET";
  const values: unknown[] = [];
  const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
  const body = () => {
    const parsed: unknown = JSON.parse(String(init.body ?? "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid database payload");
    return parsed as Record<string, unknown>;
  };
  if (table.startsWith("rpc/")) {
    const name = table.slice(4) as keyof typeof procedures;
    if (method !== "POST" || !Object.hasOwn(procedures, name) || params.size) throw new Error("Unsupported database procedure");
    const payload = body();
    const keys: readonly string[] = procedures[name];
    if (Object.keys(payload).some((key) => !keys.includes(key))) throw new Error("Unsupported procedure argument");
    return { text: `SELECT public.${name}(${keys.map((key) => bind(payload[key] ?? null)).join(",")})`, values, minimal: true };
  }
  if (!Object.hasOwn(tables, table)) throw new Error("Unsupported database table");
  const allowed = tables[table as keyof typeof tables].split(",");
  const column = (name: string) => {
    if (!allowed.includes(name)) throw new Error("Unsupported database column");
    return `"${name}"`;
  };
  const select = params.get("select") ?? "*";
  const columns = select === "*" ? allowed.map(column).join(",") : select.split(",").map(column).join(",");
  const conditions: string[] = [];
  for (const [key, value] of params) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) continue;
    const field = column(key);
    if (value.startsWith("in.(") && value.endsWith(")")) {
      conditions.push(`${field} = ANY(${bind(value.slice(4, -1).split(","))})`);
    } else {
      const match = /^(eq|gte|lte)\.(.*)$/s.exec(value);
      if (!match) throw new Error("Unsupported database filter");
      conditions.push(`${field} ${{ eq: "=", gte: ">=", lte: "<=" }[match[1]]} ${bind(match[2])}`);
    }
  }
  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  let text: string;
  const prefer = new Headers(init.headers).get("Prefer") ?? "";
  const minimal = method !== "GET" && !prefer.includes("return=representation");
  if (method === "GET") {
    text = `SELECT ${columns} FROM public.${table}${where}`;
    if (params.has("order")) text += " ORDER BY " + params.get("order")!.split(",").map((entry) => {
      const [name, direction = "asc", extra] = entry.split(".");
      if (extra || !["asc", "desc"].includes(direction)) throw new Error("Unsupported database order");
      return `${column(name)} ${direction.toUpperCase()}`;
    }).join(",");
    for (const key of ["limit", "offset"]) {
      if (!params.has(key)) continue;
      const value = Number(params.get(key));
      if (!Number.isInteger(value) || value < 0 || value > 10000) throw new Error("Invalid database range");
      text += ` ${key.toUpperCase()} ${bind(value)}`;
    }
  } else if (method === "POST" && ["asset_requests", "asset_reports", "admin_plugin_snapshots"].includes(table)) {
    if (conditions.length) throw new Error("Unsupported insert filter");
    const payload = body();
    const keys = Object.keys(payload);
    if (!keys.length) throw new Error("Empty database insert");
    text = `INSERT INTO public.${table} (${keys.map(column).join(",")}) VALUES (${keys.map((key) => bind(payload[key])).join(",")})`;
    if (params.has("on_conflict")) {
      if (params.get("on_conflict") !== "submission_id" || table === "admin_plugin_snapshots" || !prefer.includes("resolution=ignore-duplicates")) throw new Error("Unsupported database conflict policy");
      text += " ON CONFLICT (submission_id) DO NOTHING";
    }
    if (!minimal) text += ` RETURNING ${columns}`;
  } else if (method === "PATCH" && table === "asset_requests" && conditions.length) {
    const payload = body();
    const keys = Object.keys(payload);
    if (!keys.length || keys.some((key) => !["status", "updated_at"].includes(key))) throw new Error("Unsupported database update");
    text = `UPDATE public.${table} SET ${keys.map((key) => `${column(key)} = ${bind(payload[key])}`).join(",")}${where}`;
    if (!minimal) text += ` RETURNING ${columns}`;
  } else throw new Error("Unsupported database operation");
  return { text, values, minimal };
}

export async function neonStore<T>(path: string, init: RequestInit = {}): Promise<T> {
  const query = compileStoreQuery(path, init);
  const result = await database().query(query.text, query.values);
  if (query.minimal) return undefined as T;
  return result.rows.map((row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value instanceof Date) return [key, key === "day" ? value.toISOString().slice(0, 10) : value.toISOString()];
    if (["count", "downloads"].includes(key) && typeof value === "string") {
      const number = Number(value);
      if (!Number.isSafeInteger(number)) throw new Error("Database count exceeds safe integer range");
      return [key, number];
    }
    return [key, value];
  }))) as T;
}
