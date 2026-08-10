import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendPrivateRequestMetadata,
  readPrivateRequestMetadata,
  readSubmissionId
} from "./request-metadata";

const originalEnvironment = { ...process.env };
const metadata = {
  submissionId: "a0ec6ec5-6dde-4bea-b5c4-3cfdcb9b65fe",
  email: "designer@example.com",
  logoAssetUrl: "https://drive.google.com/file/d/example/view",
  notifyWhenAvailable: true
};

describe("private request metadata", () => {
  beforeEach(() => {
    process.env.LOGO_REQUEST_STORAGE_SECRET = "test-request-storage-secret-that-is-longer-than-thirty-two-characters";
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("encrypts sensitive fields and restores them for the admin API", () => {
    const body = appendPrivateRequestMetadata("Public request", metadata);

    expect(body).not.toContain(metadata.email);
    expect(body).not.toContain(metadata.logoAssetUrl);
    expect(readSubmissionId(body)).toBe(metadata.submissionId);
    expect(readPrivateRequestMetadata(body)).toEqual(metadata);
  });

  it("rejects tampered encrypted metadata", () => {
    const body = appendPrivateRequestMetadata("Public request", metadata);
    const tampered = body.replace(
      /(awalogo-private-request:\s*v1\.)([A-Za-z0-9_-])/,
      (_match, prefix: string, character: string) => `${prefix}${character === "A" ? "B" : "A"}`
    );

    expect(tampered).not.toBe(body);
    expect(readPrivateRequestMetadata(tampered)).toBeNull();
  });
});
