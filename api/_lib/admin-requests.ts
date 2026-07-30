import { z } from "zod";
import type { RepositoryIssueData } from "./github.js";

export const requestStatusSchema = z.enum([
  "new",
  "reviewing",
  "sourcing",
  "ready",
  "published",
  "declined"
]);

export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type RequestType = "logo-request" | "company-submission";

export const requestStatusOptions: Array<{
  value: RequestStatus;
  label: string;
  labelColor: string;
  description: string;
}> = [
  { value: "new", label: "New", labelColor: "d6e8a4", description: "Waiting for maintainer triage" },
  { value: "reviewing", label: "In review", labelColor: "b7d7f0", description: "Source and institution details are being checked" },
  { value: "sourcing", label: "Sourcing asset", labelColor: "f1d58a", description: "Official artwork is being located or cleaned" },
  { value: "ready", label: "Ready to publish", labelColor: "d2c4f2", description: "Verified artwork is ready for the catalog" },
  { value: "published", label: "Published", labelColor: "99d5a5", description: "The logo is live on awalogo" },
  { value: "declined", label: "Declined", labelColor: "e8b4ae", description: "The request cannot be accepted" }
];

const statusPrefix = "request-status:";

export type AdminRequest = {
  number: number;
  title: string;
  institutionName: string;
  requestType: RequestType;
  status: RequestStatus;
  category: string;
  officialWebsite: string | null;
  assetFormat: string | null;
  assetUrl: string | null;
  brandGuidelinesUrl: string | null;
  submitterRole: string | null;
  notificationRequested: boolean;
  githubUrl: string;
  authorLogin: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

export type AdminRequestSummary = {
  total: number;
  new: number;
  active: number;
  published: number;
  declined: number;
};

export function issueLabelNames(issue: Pick<RepositoryIssueData, "labels">): string[] {
  return issue.labels.flatMap((label) => {
    if (typeof label === "string") return [label];
    return label.name ? [label.name] : [];
  });
}

export function statusFromIssue(issue: Pick<RepositoryIssueData, "labels" | "state" | "state_reason">): RequestStatus {
  for (const label of issueLabelNames(issue)) {
    if (!label.startsWith(statusPrefix)) continue;
    const parsed = requestStatusSchema.safeParse(label.slice(statusPrefix.length));
    if (parsed.success) return parsed.data;
  }
  if (issue.state === "closed") return issue.state_reason === "not_planned" ? "declined" : "published";
  return "new";
}

export function statusLabel(status: RequestStatus): string {
  return `${statusPrefix}${status}`;
}

export function labelsForStatus(labels: string[], status: RequestStatus): string[] {
  return [...labels.filter((label) => !label.startsWith(statusPrefix)), statusLabel(status)];
}

function section(body: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(`(?:^|\\n)## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n---|$)`, "i"));
  return match?.[1]?.trim() || null;
}

function bulletValue(value: string | null, label: string): string | null {
  if (!value) return null;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = value.match(new RegExp(`^- ${escaped}:\\s*(.+)$`, "mi"));
  const result = match?.[1]?.trim();
  return !result || result === "Not provided" ? null : result;
}

function plainValue(value: string | null): string | null {
  if (!value || value === "Not provided" || value === "None") return null;
  return value.split("\n")[0]?.trim() || null;
}

export function parseAdminRequest(issue: RepositoryIssueData): AdminRequest | null {
  if (issue.pull_request) return null;
  const body = issue.body ?? "";
  const companySubmission = issue.title.startsWith("Company logo submission:")
    && Boolean(section(body, "Company"));
  const logoRequest = issue.title.startsWith("Logo request:")
    && Boolean(section(body, "Institution"));
  if (!companySubmission && !logoRequest) return null;

  const requestType: RequestType = companySubmission ? "company-submission" : "logo-request";
  const artwork = section(body, companySubmission ? "Logo artwork" : "Submitted logo artwork");
  const notification = section(body, "Availability notification");
  const institutionName = plainValue(section(body, companySubmission ? "Company" : "Institution"))
    ?? issue.title.replace(/^(?:Company logo submission|Logo request):\s*/i, "").trim();

  if (!institutionName) return null;

  return {
    number: issue.number,
    title: issue.title,
    institutionName,
    requestType,
    status: statusFromIssue(issue),
    category: plainValue(section(body, "Category")) ?? "Not provided",
    officialWebsite: plainValue(section(body, "Official website")),
    assetFormat: bulletValue(artwork, "Format"),
    assetUrl: bulletValue(artwork, companySubmission ? "Public file link" : "Public drive link"),
    brandGuidelinesUrl: bulletValue(artwork, "Brand guidelines"),
    submitterRole: plainValue(section(body, "Submitter role")),
    notificationRequested: notification?.toLowerCase().startsWith("requested") ?? false,
    githubUrl: issue.html_url,
    authorLogin: issue.user?.login ?? null,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at
  };
}

export function summarizeAdminRequests(requests: AdminRequest[]): AdminRequestSummary {
  return {
    total: requests.length,
    new: requests.filter((request) => request.status === "new").length,
    active: requests.filter((request) => ["reviewing", "sourcing", "ready"].includes(request.status)).length,
    published: requests.filter((request) => request.status === "published").length,
    declined: requests.filter((request) => request.status === "declined").length
  };
}
