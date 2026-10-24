import { createHmac } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import runtimeCatalog from "../../packages/catalog-ui/src/generated/runtime-catalog.json";
import expansion from "../../packages/brands/catalog.json";
import { methodNotAllowed, requireSameOrigin } from "./http.js";

const knownSlugs = new Set([...runtimeCatalog.items.map((item) => item.logo.slug), ...expansion.brands.map((brand) => brand.slug)]);
const submission = z.object({ slugs: z.array(z.string().max(160).refine((slug) => knownSlugs.has(slug))).min(1).max(50) }).strict();

async function store(path: string, options: RequestInit = {}) {
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  const origin = new URL(process.env.SUPABASE_URL ?? "https://unconfigured.invalid");
  if (!secret || origin.protocol !== "https:" || !origin.hostname.endsWith(".supabase.co")) throw new Error("Popularity storage unavailable");
  const response = await fetch(`${origin.origin}/rest/v1/${path}`, {
    ...options, signal: AbortSignal.timeout(4000),
    headers: { apikey: secret, "Content-Type": "application/json", ...options.headers }
  });
  if (!response.ok) throw new Error("Popularity storage unavailable");
  return response.status === 204 ? null : response.json();
}

export async function handlePopularity(request: VercelRequest, response: VercelResponse): Promise<void> {
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "GET") {
    try {
      const rows = await store("logo_download_totals?select=slug,downloads&limit=10000") as Array<{ slug: string; downloads: number }>;
      const counts = Object.fromEntries(rows.filter((row) => knownSlugs.has(row.slug) && Number.isSafeInteger(row.downloads) && row.downloads >= 0).map((row) => [row.slug, row.downloads]));
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
      response.status(200).json({ counts });
    } catch { response.status(503).json({ counts: {}, error: "Download statistics are temporarily unavailable" }); }
    return;
  }
  if (request.method !== "POST") return methodNotAllowed(response, ["GET", "POST"]);
  if (!requireSameOrigin(request, response)) return;
  const parsed = submission.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: "Invalid download selection" }); return; }
  try {
    const address = request.headers["x-vercel-forwarded-for"];
    const ip = (Array.isArray(address) ? address[0] : address)?.split(",")[0]?.trim() || request.socket?.remoteAddress;
    if (!ip || !process.env.SUPABASE_SECRET_KEY) throw new Error("Download counting unavailable");
    // A daily, one-way network key limits repeats without storing IP addresses or cookies.
    const visitor = createHmac("sha256", process.env.SUPABASE_SECRET_KEY).update(`${new Date().toISOString().slice(0, 10)}:${ip}`).digest("hex");
    await store("rpc/record_logo_downloads", { method: "POST", body: JSON.stringify({ requested_slugs: [...new Set(parsed.data.slugs)], network_key: visitor }) });
    response.status(202).json({ ok: true });
  } catch { response.status(503).json({ error: "Download counting is temporarily unavailable" }); }
}
