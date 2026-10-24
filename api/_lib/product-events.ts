import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, randomUUID } from "node:crypto";
import { productEventSchema } from "../../packages/admin/events.js";
import { adminResources } from "./admin-resources.js";
import { adminStore } from "./admin-store.js";
import { requireSameOrigin, methodNotAllowed } from "./http.js";
const resources = new Map(adminResources().map((r) => [r.id, r]));
const attempts = new Map<string, { at: number; count: number }>();
const secret = randomUUID();
export async function handleProductEvents(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!requireSameOrigin(req, res)) return;
  if (
    process.env.VERCEL_ENV !== "production" ||
    process.env.ENABLE_PRODUCT_ANALYTICS !== "true" ||
    !["awalogo.com", "www.awalogo.com"].includes(String(req.headers.host)) ||
    req.headers.dnt === "1" ||
    req.headers["sec-gpc"] === "1"
  ) {
    res.status(202).json({ ok: true, disabled: true });
    return;
  }
  const parsed = productEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product event" });
    return;
  }
  const e = parsed.data;
  const resource = e.resource ? resources.get(e.resource) : null;
  if (e.resource && !resource) {
    res.status(400).json({ error: "Unknown resource" });
    return;
  }
  if (
    resource &&
    e.format &&
    e.format !== "zip" &&
    !resource.formats.some((f) => f.type === e.format)
  ) {
    res.status(400).json({ error: "Unknown format" });
    return;
  }
  const now = Date.now();
  for (const [key, b] of attempts) if (now - b.at > 60000) attempts.delete(key);
  const address = String(
    req.headers["x-vercel-forwarded-for"] ??
      req.socket?.remoteAddress ??
      "unknown",
  );
  const key = createHmac("sha256", secret).update(address).digest("hex");
  const bucket = attempts.get(key) ?? { at: now, count: 0 };
  if (bucket.count >= 120 || attempts.size > 10000) {
    res.status(429).json({ error: "Event limit reached" });
    return;
  }
  bucket.count++;
  attempts.set(key, bucket);
  try {
    await adminStore("rpc/record_product_event", {
      method: "POST",
      body: JSON.stringify({
        event_id: e.id,
        event_name: e.event,
        resource_id: e.resource,
        event_format: e.format,
        event_detail: e.detail,
      }),
    });
    res.status(202).json({ ok: true });
  } catch {
    res.status(503).json({ error: "Product metrics unavailable" });
  }
}
