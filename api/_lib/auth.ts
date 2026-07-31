import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SESSION_COOKIE = "nbl_admin_session";
const STATE_COOKIE = "nbl_oauth_state";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

export type AdminSession = {
  login: string;
  avatarUrl: string;
  exp: number;
  githubToken?: string;
  local?: boolean;
};

function isLocalAdminRequest(request: VercelRequest): boolean {
  const host = request.headers.host ?? "";
  const localHost = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(host);
  return process.env.AWALOGO_LOCAL_ADMIN_BYPASS === "1" &&
    !process.env.VERCEL &&
    localHost &&
    request.headers["x-awalogo-local-admin"] === "1";
}

function localAdminSession(request: VercelRequest): AdminSession | null {
  if (!isLocalAdminRequest(request)) return null;
  return {
    login: "local-admin",
    avatarUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23c9e45d'/%3E%3Cpath d='M9 16h14M16 9v14' stroke='%23292a27' stroke-width='2'/%3E%3C/svg%3E",
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
    local: true
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseCookies(request: VercelRequest): Record<string, string> {
  const header = request.headers.cookie ?? "";
  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 0) return [];
      return [[part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())]];
    })
  );
}

function signature(payload: string): string {
  const secret = requiredEnv("ADMIN_SESSION_SECRET");
  if (secret.length < 32) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function sessionKey(): Buffer {
  return createHash("sha256").update(requiredEnv("ADMIN_SESSION_SECRET")).digest();
}

function sealSession(session: AdminSession): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final()
  ]);
  return [
    "v2",
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url")
  ].join(".");
}

function openSession(value: string): AdminSession | null {
  const [, encodedIv, encodedCiphertext, encodedTag] = value.split(".");
  if (!encodedIv || !encodedCiphertext || !encodedTag) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(), Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final()
    ]);
    return JSON.parse(plaintext.toString("utf8")) as AdminSession;
  } catch {
    return null;
  }
}

function secureCookie(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function cookie(name: string, value: string, maxAge: number): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secureCookie() ? "Secure" : "",
    `Max-Age=${maxAge}`
  ].filter(Boolean).join("; ");
}

function appendCookie(response: VercelResponse, value: string): void {
  const current = response.getHeader("Set-Cookie");
  const cookies = current ? (Array.isArray(current) ? current.map(String) : [String(current)]) : [];
  response.setHeader("Set-Cookie", [...cookies, value]);
}

export function issueSession(response: VercelResponse, login: string, avatarUrl: string, githubToken?: string): void {
  const session: AdminSession = {
    login,
    avatarUrl,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
    githubToken
  };
  appendCookie(response, cookie(SESSION_COOKIE, sealSession(session), SESSION_DURATION_SECONDS));
}

export function readSession(request: VercelRequest): AdminSession | null {
  const localSession = localAdminSession(request);
  if (localSession) return localSession;
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  if (token.startsWith("v2.")) {
    const session = openSession(token);
    if (!session?.login || !session.avatarUrl || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  }

  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return null;

  const expected = Buffer.from(signature(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (!session.login || !session.avatarUrl || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function requireAdmin(request: VercelRequest, response: VercelResponse): AdminSession | null {
  const session = readSession(request);
  if (!session || (!session.local && !isAllowedAdmin(session.login))) {
    response.status(401).json({ error: "Admin authentication required" });
    return null;
  }
  return session;
}

export function clearSession(response: VercelResponse): void {
  appendCookie(response, cookie(SESSION_COOKIE, "", 0));
}

export function createOAuthState(response: VercelResponse): string {
  const state = randomBytes(24).toString("base64url");
  appendCookie(response, cookie(STATE_COOKIE, state, 10 * 60));
  return state;
}

export function consumeOAuthState(request: VercelRequest, response: VercelResponse, supplied: string): boolean {
  const expected = parseCookies(request)[STATE_COOKIE];
  appendCookie(response, cookie(STATE_COOKIE, "", 0));
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function isAllowedAdmin(login: string): boolean {
  const allowed = requiredEnv("ADMIN_GITHUB_LOGINS")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(login.toLowerCase());
}

export function oauthClientId(): string {
  return requiredEnv("GITHUB_OAUTH_CLIENT_ID");
}

export function oauthClientSecret(): string {
  return requiredEnv("GITHUB_OAUTH_CLIENT_SECRET");
}
