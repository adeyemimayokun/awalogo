import { describe, expect, it } from "vitest";
import {
  labelsForStatus,
  parseAdminRequest,
  statusFromIssue,
  summarizeAdminRequests
} from "./admin-requests.js";
import type { RepositoryIssueData } from "./github.js";

function issue(overrides: Partial<RepositoryIssueData> = {}): RepositoryIssueData {
  return {
    html_url: "https://github.com/adeyemimayokun/awalogo/issues/42",
    number: 42,
    title: "Logo request: Example Finance",
    body: [
      "## Institution",
      "Example Finance",
      "",
      "## Category",
      "Fintech",
      "",
      "## Official website",
      "https://example.com",
      "",
      "## Submitted logo artwork",
      "- Format: SVG",
      "- Public drive link: https://drive.google.com/example",
      "",
      "## Availability notification",
      "Requested. Contact details are held privately by the maintainers."
    ].join("\n"),
    state: "open",
    state_reason: null,
    labels: ["logo-request"],
    user: { login: "awalogo-site" },
    created_at: "2026-07-30T10:00:00Z",
    updated_at: "2026-07-30T10:00:00Z",
    closed_at: null,
    ...overrides
  };
}

describe("admin request parsing", () => {
  it("parses a public logo request without exposing contact details", () => {
    const request = parseAdminRequest(issue());
    expect(request).toMatchObject({
      institutionName: "Example Finance",
      requestType: "logo-request",
      status: "new",
      category: "Fintech",
      assetFormat: "SVG",
      assetUrl: "https://drive.google.com/example",
      notificationRequested: true
    });
    expect(request).not.toHaveProperty("email");
  });

  it("parses an official company submission", () => {
    const request = parseAdminRequest(issue({
      title: "Company logo submission: Company Bank",
      body: [
        "## Company",
        "Company Bank",
        "",
        "## Official website",
        "https://company.example",
        "",
        "## Category",
        "Bank",
        "",
        "## Submitter role",
        "Brand manager",
        "",
        "## Logo artwork",
        "- Format: Brand kit",
        "- Public file link: https://drive.google.com/brand-kit",
        "- Brand guidelines: https://company.example/brand"
      ].join("\n")
    }));
    expect(request).toMatchObject({
      institutionName: "Company Bank",
      requestType: "company-submission",
      submitterRole: "Brand manager",
      brandGuidelinesUrl: "https://company.example/brand",
      notificationRequested: false
    });
  });

  it("ignores pull requests and unrelated issues", () => {
    expect(parseAdminRequest(issue({ pull_request: {} }))).toBeNull();
    expect(parseAdminRequest(issue({ title: "Documentation typo", body: "No structured request" }))).toBeNull();
    expect(parseAdminRequest(issue({
      title: "Vendor research",
      body: "## Company\nExample Finance\n\n## Category\nFintech"
    }))).toBeNull();
  });
});

describe("admin request workflow", () => {
  it("reads status labels and maps legacy closed issues", () => {
    expect(statusFromIssue(issue({ labels: ["logo-request", "request-status:sourcing"] }))).toBe("sourcing");
    expect(statusFromIssue(issue({ state: "closed", state_reason: "not_planned" }))).toBe("declined");
    expect(statusFromIssue(issue({ state: "closed", state_reason: "completed" }))).toBe("published");
  });

  it("replaces only the request status label", () => {
    expect(labelsForStatus(["logo-request", "request-status:new", "official-source"], "reviewing")).toEqual([
      "logo-request",
      "official-source",
      "request-status:reviewing"
    ]);
  });

  it("summarizes active and terminal requests", () => {
    const requests = ["new", "reviewing", "sourcing", "ready", "published", "declined"]
      .map((status, index) => parseAdminRequest(issue({
        number: index + 1,
        labels: [`request-status:${status}`]
      })))
      .filter((request) => request !== null);
    expect(summarizeAdminRequests(requests)).toEqual({
      total: 6,
      new: 1,
      active: 3,
      published: 1,
      declined: 1
    });
  });
});
