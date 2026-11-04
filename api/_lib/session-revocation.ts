import { createHash } from "node:crypto";
import { adminStore } from "./admin-store.js";

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function isSessionRevoked(token: string): Promise<boolean> {
  const rows = await adminStore<Array<{ token_hash: string }>>(
    `admin_session_revocations?select=token_hash&token_hash=eq.${tokenHash(token)}&limit=1`,
  );
  return rows.length > 0;
}

export async function revokeSession(token: string, expiresAt: number): Promise<void> {
  // Persist only a digest, never the cookie or its encrypted GitHub credential.
  await adminStore("rpc/revoke_admin_session", {
    method: "POST",
    body: JSON.stringify({ session_hash: tokenHash(token), session_expiry: new Date(expiresAt * 1000).toISOString() }),
  });
}
