import { createHash, randomBytes } from "node:crypto";
import type { PublicLogoRequest } from "./logo-requests.js";

export type StoredAssetRequest = {
  submission_id: string;
  brand_name: string;
  website: string;
  category: string;
  contact_email: string;
  asset_url: string | null;
  notify_when_available: boolean;
  status: "pending" | "in-review" | "needs-info" | "approved" | "completed" | "rejected";
  github_issue_number: number | null;
  created_at: string;
  updated_at: string;
};

export function requestStoreConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

async function requestStore<T>(path: string, options: RequestInit = {}): Promise<T> {
  const origin = process.env.SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!origin || !secret) throw new Error("Request database is not configured");
  const url = new URL(origin);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) throw new Error("Invalid Supabase project URL");
  const response = await fetch(`${url.origin}/rest/v1/asset_requests${path}`, {
    ...options,
    signal: AbortSignal.timeout(10000),
    headers: { apikey: secret, "Content-Type": "application/json", ...options.headers }
  });
  if (!response.ok) throw new Error(`Request database operation failed (${response.status})`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function saveAssetRequest(request: PublicLogoRequest): Promise<string | null> {
  const token = request.trackingToken ?? randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  await requestStore("?on_conflict=submission_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      submission_id: request.submissionId,
      brand_name: request.institutionName,
      website: request.officialWebsite,
      category: request.category,
      contact_email: request.email,
      asset_url: request.logoAssetUrl || null,
      notify_when_available: request.notifyWhenAvailable,
      tracking_token_hash: hash
    })
  });
  const matching = await requestStore<Array<{ submission_id: string }>>(`?submission_id=eq.${encodeURIComponent(request.submissionId)}&tracking_token_hash=eq.${hash}&select=submission_id&limit=1`);
  if (!matching.length) return null;
  return `/v2/requests?token=${encodeURIComponent(token)}`;
}

const privateColumns = "submission_id,brand_name,website,category,contact_email,asset_url,notify_when_available,status,github_issue_number,created_at,updated_at";
export async function listAssetRequests(): Promise<StoredAssetRequest[]> {
  return requestStore(`?select=${privateColumns}&order=created_at.desc&limit=200`);
}

export async function updateAssetRequest(submissionId: string, status: StoredAssetRequest["status"]): Promise<StoredAssetRequest | null> {
  const items = await requestStore<StoredAssetRequest[]>(`?submission_id=eq.${encodeURIComponent(submissionId)}&select=${privateColumns}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() })
  });
  return items[0] ?? null;
}

export async function getAssetRequestStatus(token: string): Promise<{ brand_name: string; status: string; updated_at: string } | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const items = await requestStore<Array<{ brand_name: string; status: string; updated_at: string }>>(`?tracking_token_hash=eq.${hash}&select=brand_name,status,updated_at&limit=1`);
  return items[0] ?? null;
}
