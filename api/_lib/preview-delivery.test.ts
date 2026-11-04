import { afterEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "./vercel-types";
import { previewDeliveryDisabled } from "./preview-delivery";

const mocks = vi.hoisted(() => ({ save: vi.fn(), email: vi.fn(), issues: vi.fn(), configured: vi.fn(), reportStore: vi.fn() }));
vi.mock("./request-store.js", () => ({ requestStoreConfigured: mocks.configured, saveAssetRequest: mocks.save, getAssetRequestStatus: vi.fn() }));
vi.mock("./request-abuse.js", () => ({ claimLogoRequest: vi.fn(async () => ({ kind: "accepted", token: "a".repeat(43), finish: vi.fn(), releaseStorage: vi.fn(), beginDelivery: vi.fn() })), deployedRequests: () => true }));
vi.mock("./admin-store.js", () => ({ adminStoreConfigured: mocks.configured, adminStore: mocks.reportStore }));
vi.mock("./email.js", () => ({ sendPrivateLogoRequest: mocks.email, sendLogoReport: mocks.email }));
vi.mock("./github.js", () => ({ createRepositoryIssue: mocks.issues, listRepositoryIssues: mocks.issues }));
import handler from "../logo-requests";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

function request(body: unknown, view?: string) {
  return { method: "POST", headers: { host: "staging.example", origin: "https://staging.example" }, query: view ? { view } : {}, body } as unknown as VercelRequest;
}
function response() {
  const res = { code: 0, body: undefined as unknown, setHeader: vi.fn(), status(code: number) { res.code = code; return res; }, json(body: unknown) { res.body = body; return res; } };
  return res;
}
const submission = { submissionId: "a37cca64-81a0-4620-a051-5401a765f52e", institutionName: "Preview test", officialWebsite: "https://example.com", email: "test@example.com", category: "Other", logoAssetUrl: "", notifyWhenAvailable: false };
describe("isolated preview delivery", () => {
  it("cannot disable production notifications", () => {
    vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("DISABLE_PREVIEW_DELIVERY", "true");
    expect(previewDeliveryDisabled()).toBe(false);
  });
  it("saves preview requests without sending email or creating GitHub issues", async () => {
    vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("DISABLE_PREVIEW_DELIVERY", "true");
    mocks.configured.mockReturnValue(true); mocks.save.mockResolvedValue("/requests?token=test");
    const res = response(); await handler(request(submission), res as unknown as VercelResponse);
    expect(res.code).toBe(202); expect(res.body).toMatchObject({ ok: true, emailDelivered: false, issue: null });
    expect(mocks.save).toHaveBeenCalled(); expect(mocks.email).not.toHaveBeenCalled(); expect(mocks.issues).not.toHaveBeenCalled();
  });
  it("fails closed if preview persistence is unavailable", async () => {
    vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("DISABLE_PREVIEW_DELIVERY", "true");
    mocks.configured.mockReturnValue(false);
    const res = response(); await handler(request(submission), res as unknown as VercelResponse);
    expect(res.code).toBe(503); expect(mocks.email).not.toHaveBeenCalled(); expect(mocks.issues).not.toHaveBeenCalled();
  });
  it("stores preview reports without external notifications", async () => {
    vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("DISABLE_PREVIEW_DELIVERY", "true");
    mocks.configured.mockReturnValue(true); mocks.reportStore.mockResolvedValue(undefined);
    const res = response(); await handler(request({ submissionId: submission.submissionId, slug: "access-bank", variation: "primary", format: "svg", reason: "Wrong asset" }, "report"), res as unknown as VercelResponse);
    expect(res.code).toBe(202); expect(mocks.reportStore).toHaveBeenCalled(); expect(mocks.email).not.toHaveBeenCalled();
  });
});
