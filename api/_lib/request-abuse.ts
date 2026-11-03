import { createHash, createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import type { VercelRequest } from "./vercel-types";
import type { PublicLogoRequest } from "./logo-requests.js";

type Reply = { status: number; body: Record<string, unknown>; retryStorage?: boolean };
type Decision = { kind: "accepted" | "pending" | "retry" | "conflict" | "limited"; reply?: Reply; leaseId?: string };
type Receipt = { token: string; fingerprint: string; reply?: Reply; expires: number; leaseId: string; leaseUntil: number; delivery: boolean };
const receipts = new Map<string, Receipt>();
const budgets = new Map<string, { count: number; expires: number }>();
let pool: Pool | undefined;
let connection: string | undefined;
export const deployedRequests = () => Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === "production");

function database() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Durable request abuse store unavailable");
  if (!pool || connection !== url) {
    if (pool) void pool.end().catch(() => undefined);
    const parsed = new URL(url);
    if (parsed.searchParams.get("sslmode") === "require") parsed.searchParams.set("sslmode", "verify-full");
    pool = new Pool({ connectionString: parsed.toString(), max: 1, idleTimeoutMillis: 5000, connectionTimeoutMillis: 10000, statement_timeout: 10000 });
    attachDatabasePool(pool);
    pool.on("error", () => console.error("Request abuse database connection failed"));
    connection = url;
  }
  return pool;
}

export function requestAbuseKeys(request: VercelRequest, submission: PublicLogoRequest) {
  const secret = process.env.LOGO_REQUEST_ABUSE_SECRET?.trim();
  if (deployedRequests() && (!secret || secret.length < 32)) throw new Error("Request abuse secret unavailable");
  // Vercel overwrites this header. Never trust client-supplied X-Forwarded-For.
  const header = request.headers["x-vercel-forwarded-for"];
  const ip = deployedRequests() ? (typeof header === "string" ? header.trim() : "") : request.socket?.remoteAddress ?? "127.0.0.1";
  if (!isIP(ip)) throw new Error("Trusted request network unavailable");
  const normalized = ip.includes(":") ? new URL(`http://[${ip}]/`).hostname.slice(1, -1) : ip;
  // IPv6 addresses share a /64 budget, including compressed address spellings.
  const expanded = normalized.includes(":") ? (() => {
    const [left, right = ""] = normalized.split("::");
    const a = left ? left.split(":") : [], b = right ? right.split(":") : [];
    return [...a, ...Array(8 - a.length - b.length).fill("0"), ...b].slice(0, 4).map(x => x.padStart(4, "0")).join(":");
  })() : normalized;
  const hash = (kind: string, value: string) => createHmac("sha256", secret || "local-development-only").update(`${kind}:${value}`).digest("hex");
  return { network: hash("network", expanded), recipient: hash("recipient", submission.email.toLowerCase()) };
}

export async function claimLogoRequest(request: VercelRequest, submission: PublicLogoRequest) {
  const keys = requestAbuseKeys(request, submission);
  const token = submission.trackingToken ?? randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { trackingToken: _, ...payload } = submission;
  const fingerprint = createHmac("sha256", process.env.LOGO_REQUEST_ABUSE_SECRET || "local-development-only").update(JSON.stringify(payload)).digest("hex");
  let decision: Decision;
  if (process.env.DATABASE_URL?.trim()) {
    const result = await database().query("SELECT public.claim_logo_request($1,$2,$3,$4,$5) AS decision", [submission.submissionId, tokenHash, fingerprint, keys.network, keys.recipient]);
    decision = result.rows[0].decision as Decision;
  } else {
    if (deployedRequests()) throw new Error("Durable request abuse store unavailable");
    const now = Date.now();
    for (const [id, item] of receipts) if (item.expires <= now) receipts.delete(id);
    for (const [id, item] of budgets) if (item.expires <= now) budgets.delete(id);
    const prior = receipts.get(submission.submissionId);
    if (prior) {
      if (prior.token !== tokenHash || prior.fingerprint !== fingerprint) decision = { kind: "conflict" };
      else if (prior.reply?.retryStorage || (!prior.reply && !prior.delivery && prior.leaseUntil <= now)) {
        prior.reply = undefined; prior.leaseId = randomBytes(16).toString("hex"); prior.leaseUntil = now + 60000;
        decision = { kind: "accepted", leaseId: prior.leaseId };
      }
      else decision = prior.reply && prior.reply.status >= 200 && prior.reply.status < 300 ? { kind: "retry", reply: prior.reply } : { kind: "pending" };
    }
    else {
      const limits: Array<[string, number, number]> = [[keys.network, 5, 3600000], [keys.recipient, 3, 86400000], ["global", 100, 86400000]];
      if (limits.some(([id, limit]) => (budgets.get(id)?.count ?? 0) >= limit)) decision = { kind: "limited" };
      else {
        for (const [id, , ttl] of limits) { const item = budgets.get(id) ?? { count: 0, expires: now + ttl }; item.count++; budgets.set(id, item); }
        const leaseId = randomBytes(16).toString("hex");
        receipts.set(submission.submissionId, { token: tokenHash, fingerprint, expires: now + 30 * 86400000, leaseId, leaseUntil: now + 60000, delivery: false });
        decision = { kind: "accepted", leaseId };
      }
    }
  }
  if (!["accepted", "pending", "retry", "conflict", "limited"].includes(decision?.kind)) throw new Error("Invalid abuse store result");
  const writeReply = async (reply: Reply) => {
    const { trackingUrl: _url, trackingToken: _token, ...body } = reply.body;
    if (process.env.DATABASE_URL?.trim()) {
      const result = await database().query("UPDATE public.logo_request_receipts SET reply=$3::jsonb WHERE submission_id=$1 AND token_hash=$2 AND reply->>'leaseId'=$4 RETURNING submission_id", [submission.submissionId, tokenHash, JSON.stringify({ ...reply, body, leaseId: decision.leaseId }), decision.leaseId]);
      if (!result.rows.length) throw new Error("Request claim ownership lost");
    } else {
      const receipt = receipts.get(submission.submissionId);
      if (!receipt || receipt.leaseId !== decision.leaseId) throw new Error("Request claim ownership lost");
      receipt.reply = reply;
    }
  };
  return { ...decision, token, finish: writeReply, async beginDelivery() {
    if (process.env.DATABASE_URL?.trim()) {
      const result = await database().query("UPDATE public.logo_request_receipts SET reply=jsonb_build_object('phase','delivery','leaseId',$3::text) WHERE submission_id=$1 AND token_hash=$2 AND reply->>'phase'='storage' AND reply->>'leaseId'=$3 AND (reply->>'leaseUntil')::timestamptz > now() RETURNING submission_id", [submission.submissionId, tokenHash, decision.leaseId]);
      if (!result.rows.length) throw new Error("Request storage lease expired");
    } else {
      const receipt = receipts.get(submission.submissionId);
      if (!receipt || receipt.leaseId !== decision.leaseId || receipt.leaseUntil <= Date.now() || receipt.delivery) throw new Error("Request storage lease expired");
      receipt.delivery = true;
    }
  }, async releaseStorage() {
    await writeReply({ status: 503, body: { error: "Request storage failed. Retry with the same submission and tracking token." }, retryStorage: true });
  } };
}
