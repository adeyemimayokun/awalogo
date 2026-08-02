import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";
import { z } from "zod";

const encryptedMarker = /<!--\s*awalogo-private-request:\s*(v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\s*-->/i;
const submissionMarker = /<!--\s*awalogo-submission-id:\s*([0-9a-f-]{36})\s*-->/i;

const storedRequestMetadataSchema = z.object({
  submissionId: z.string().uuid(),
  email: z.string().email().max(254),
  logoAssetUrl: z.string(),
  notifyWhenAvailable: z.boolean()
});

export type StoredRequestMetadata = z.infer<typeof storedRequestMetadataSchema>;

function storageKey(): Buffer {
  const secret = process.env.LOGO_REQUEST_STORAGE_SECRET ?? process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("LOGO_REQUEST_STORAGE_SECRET or ADMIN_SESSION_SECRET must be at least 32 characters");
  }
  return createHash("sha256").update(secret).digest();
}

export function appendPrivateRequestMetadata(body: string, metadata: StoredRequestMetadata): string {
  const parsed = storedRequestMetadataSchema.parse(metadata);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", storageKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(parsed), "utf8"),
    cipher.final()
  ]);
  const sealed = [
    "v1",
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url")
  ].join(".");
  return [
    body.trimEnd(),
    "",
    `<!-- awalogo-submission-id: ${parsed.submissionId} -->`,
    `<!-- awalogo-private-request: ${sealed} -->`
  ].join("\n");
}

export function readPrivateRequestMetadata(body: string | null): StoredRequestMetadata | null {
  const sealed = body?.match(encryptedMarker)?.[1];
  if (!sealed) return null;
  const [, encodedIv, encodedCiphertext, encodedTag] = sealed.split(".");
  if (!encodedIv || !encodedCiphertext || !encodedTag) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", storageKey(), Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final()
    ]);
    return storedRequestMetadataSchema.parse(JSON.parse(plaintext.toString("utf8")));
  } catch {
    return null;
  }
}

export function readSubmissionId(body: string | null): string | null {
  return body?.match(submissionMarker)?.[1]?.toLowerCase() ?? null;
}
