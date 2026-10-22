import { adminStore, adminStoreConfigured } from './admin-store.js';
import { createHmac, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import catalog from "../../packages/catalog-ui/src/generated/runtime-catalog.json";
import expansion from "../../packages/brands/catalog.json";
import historical from "../../packages/brands/historical-catalog.json";
import { methodNotAllowed, requireSameOrigin } from "./http.js";
import { sendLogoReport } from "./email.js";

export const logoReportSchema = z.object({
  submissionId: z.string().uuid(),
  slug: z.string().max(160),
  variation: z.string().max(160),
  format: z.enum(["svg", "png", "webp", "jpeg"]),
  reason: z.enum(["Outdated logo", "Wrong color", "Wrong asset", "Broken download", "Other"]),
  note: z.string().trim().max(2000).default(""),
  officialSource: z.union([z.literal(""), z.string().trim().max(2048).url().refine((value) => {
    const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  })]).default(""),
  websiteConfirm: z.literal("").default("")
}).strict().refine((report) => report.reason !== "Other" || report.note.length >= 10, { path: ["note"], message: "Please describe the issue in at least 10 characters." });

export type LogoReport = z.infer<typeof logoReportSchema>;
// Best-effort per-instance throttling. Keep identifiers private and expire them quickly.
const attempts = new Map<string, { count: number; reset: number }>();
const secret = process.env.LOGO_REPORT_RATE_SECRET || randomUUID();
export async function handleLogoReport(request: VercelRequest, response: VercelResponse): Promise<void> {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (!requireSameOrigin(request, response)) return;
  const parsed = logoReportSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the report and try again." }); return; }
  const report = parsed.data;
  const logo = catalog.items.find((item) => item.logo.slug === report.slug)?.logo ?? expansion.brands.map((brand) => ({ ...brand, variations: [] as { id: string; formats: typeof brand.formats }[] })).find((brand) => brand.slug === report.slug);
  const formats = report.variation === "primary" ? logo?.formats : logo?.variations.find((variation) => variation.id === report.variation)?.formats ?? historical.variations.find((variation) => variation.slug === report.slug && variation.id === report.variation)?.formats;
  if (!logo || !formats?.some((asset) => asset.type === report.format)) { response.status(400).json({ error: "This logo version or format is no longer available. Reopen the logo and try again." }); return; }
  const ip = request.headers["x-vercel-forwarded-for"] || request.socket?.remoteAddress || "unknown";
  const key = createHmac("sha256", secret).update(Array.isArray(ip) ? ip[0] : ip).digest("hex");
  const now = Date.now();
  for (const [storedKey, bucket] of attempts) if (bucket.reset <= now) attempts.delete(storedKey);
  const bucket = attempts.get(key) ?? { count: 0, reset: now + 3600000 };
  if (bucket.count >= 5 || attempts.size >= 10000) { response.setHeader("Retry-After", "3600"); response.status(429).json({ error: "Too many reports. Please try again later." }); return; }
  bucket.count += 1; attempts.set(key, bucket);
  try {
    let stored=false;
    if(adminStoreConfigured()) { await adminStore('asset_reports?on_conflict=submission_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({submission_id:report.submissionId,slug:report.slug,variation:report.variation,format:report.format,reason:report.reason,note:report.note,official_source:report.officialSource})});stored=true; }
    try { await sendLogoReport(report, logo.name); } catch (error) { if(!stored) throw error; }
    response.status(202).json({ ok: true, reportId: report.submissionId });
  } catch {
    response.status(503).json({ error: "Your report could not be delivered. Your details are still here; please try again shortly." });
  }
}
