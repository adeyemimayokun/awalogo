import { afterEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleLogoReport, logoReportSchema } from "./logo-report.js";
import { sendLogoReport } from "./email.js";
import { maintainerLogoReportTemplate } from "./email-templates.js";

vi.mock("./email.js", () => ({ sendLogoReport: vi.fn() }));
const valid = { submissionId: "a0ec6ec5-6dde-4bea-b5c4-3cfdcb9b65fe", slug: "opay", variation: "primary", format: "svg", reason: "Outdated logo", note: "The wordmark has changed.", officialSource: "https://company.example/brand", websiteConfirm: "" };
function req(body: unknown = valid, origin = "https://awalogo.com", ip = crypto.randomUUID()) {
  return { method: "POST", body, headers: { origin, host: "awalogo.com", "x-vercel-forwarded-for": ip } } as unknown as VercelRequest;
}
function res() {
  const value = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() }; value.status.mockReturnValue(value);
  return value as unknown as VercelResponse;
}
afterEach(() => vi.clearAllMocks());
describe("logo reports", () => {
  it("accepts V2 additions and rejects invented SVGs for raster-only brands", async () => {
    vi.mocked(sendLogoReport).mockResolvedValue();
    const response = res();
    await handleLogoReport(req({ ...valid, slug: "seamlesshr", format: "png" }), response);
    expect(response.status).toHaveBeenCalledWith(202);
    expect(sendLogoReport).toHaveBeenCalledWith(expect.objectContaining({ slug: "seamlesshr" }), "SeamlessHR");
    const rejected = res();
    await handleLogoReport(req({ ...valid, slug: "seamlesshr", format: "svg" }), rejected);
    expect(rejected.status).toHaveBeenCalledWith(400);
  });
  it("validates all reasons and rejects unsafe sources, honeypots, and overlong notes", () => {
    for (const reason of ["Outdated logo", "Wrong color", "Wrong asset", "Broken download", "Other"]) expect(logoReportSchema.safeParse({ ...valid, reason }).success).toBe(true);
    for (const change of [{ reason: "Unknown" }, { reason: "Other", note: "" }, { officialSource: "javascript:alert(1)" }, { officialSource: "https://user:secret@example.com" }, { websiteConfirm: "spam" }, { note: "x".repeat(2001) }]) expect(logoReportSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
  it("rejects cross-origin submissions without sending", async () => {
    const response = res(); await handleLogoReport(req(valid, "https://other.example"), response);
    expect(response.status).toHaveBeenCalledWith(403); expect(sendLogoReport).not.toHaveBeenCalled();
  });
  it("rejects unknown logos, versions, and formats without sending", async () => {
    for (const change of [{ slug: "unknown" }, { variation: "missing-version" }, { format: "jpeg" }]) {
      const response = res(); await handleLogoReport(req({ ...valid, ...change }), response);
      expect(response.status).toHaveBeenCalledWith(400);
    }
    expect(sendLogoReport).not.toHaveBeenCalled();
  });
  it("uses the canonical company name and confirms only delivered reports", async () => {
    vi.mocked(sendLogoReport).mockResolvedValueOnce(); const response = res();
    await handleLogoReport(req(), response);
    expect(sendLogoReport).toHaveBeenCalledWith(valid, "OPay"); expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({ ok: true, reportId: valid.submissionId });
  });
  it("returns a retryable error when delivery fails", async () => {
    vi.mocked(sendLogoReport).mockRejectedValueOnce(new Error("private provider details")); const response = res();
    await handleLogoReport(req(), response); expect(response.status).toHaveBeenCalledWith(503);
    expect(JSON.stringify(vi.mocked(response.json).mock.calls)).not.toContain("private provider details");
  });
  it("throttles repeated submissions on the same instance", async () => {
    vi.mocked(sendLogoReport).mockResolvedValue(); const ip = crypto.randomUUID();
    for (let index = 0; index < 5; index++) await handleLogoReport(req(valid, undefined, ip), res());
    const response = res(); await handleLogoReport(req(valid, undefined, ip), response);
    expect(response.status).toHaveBeenCalledWith(429); expect(sendLogoReport).toHaveBeenCalledTimes(5);
  });
  it("escapes the branded email and includes report context", () => {
    const message = maintainerLogoReportTemplate(logoReportSchema.parse({ ...valid, note: "<script>alert(1)</script>" }), "Example <Brand>");
    expect(message.html).toContain("Example &lt;Brand&gt;"); expect(message.html).not.toContain("<script>");
    expect(message.text).toContain("Version: primary"); expect(message.text).toContain("Format: SVG");
  });
});
