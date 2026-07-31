import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type GitHubContent = { content: string; encoding: string };
type GitRef = { object: { sha: string } };
type GitCommit = { tree: { sha: string } };
type GitBlob = { sha: string };
type PullRequest = { html_url: string; number: number; local?: boolean };
export type RepositoryIssue = {
  body: string | null;
  created_at: string;
  html_url: string;
  labels: Array<{ name: string }>;
  number: number;
  state: "open" | "closed";
  title: string;
  updated_at: string;
  user: { avatar_url: string; login: string } | null;
  pull_request?: unknown;
};
export type RepositoryNotification = {
  id: string;
  reason: string;
  repository: { full_name: string; html_url: string };
  subject: { latest_comment_url: string | null; title: string; type: string; url: string | null };
  unread: boolean;
  updated_at: string;
  url: string;
};

export type FileChange = { path: string; content: Buffer | null };

const localChanges = new Map<string, Buffer | null>();
const localIssues = new Map<number, RepositoryIssue>([
  [104, {
    body: [
      "## Institution",
      "Nomba",
      "",
      "## Category",
      "Payments",
      "",
      "## Official website",
      "https://nomba.com",
      "",
      "## Submitted logo artwork",
      "- Public drive link: Not provided",
      "",
      "## Availability notification",
      "Requested. Contact details are held privately by the maintainers."
    ].join("\n"),
    created_at: "2026-07-29T09:22:00.000Z",
    html_url: "https://github.com/adeyemimayokun/awalogo/issues/104",
    labels: [{ name: "logo-request" }],
    number: 104,
    state: "open",
    title: "Logo request: Nomba",
    updated_at: "2026-07-29T09:22:00.000Z",
    user: { avatar_url: "", login: "local-contributor" }
  }],
  [103, {
    body: [
      "## Institution",
      "VFD Microfinance Bank",
      "",
      "## Category",
      "Bank",
      "",
      "## Official website",
      "https://vbank.ng",
      "",
      "## Submitted logo artwork",
      "- Public drive link: https://drive.google.com/example",
      "",
      "## Availability notification",
      "Not requested."
    ].join("\n"),
    created_at: "2026-07-27T14:08:00.000Z",
    html_url: "https://github.com/adeyemimayokun/awalogo/issues/103",
    labels: [{ name: "logo-request" }, { name: "request-in-review" }],
    number: 103,
    state: "open",
    title: "Logo request: VFD Microfinance Bank",
    updated_at: "2026-07-30T11:16:00.000Z",
    user: { avatar_url: "", login: "local-contributor" }
  }],
  [101, {
    body: [
      "## Institution",
      "Kuda Business",
      "",
      "## Category",
      "Finance app",
      "",
      "## Official website",
      "https://kuda.com",
      "",
      "## Submitted logo artwork",
      "- Public drive link: Not provided",
      "",
      "## Availability notification",
      "Requested. Contact details are held privately by the maintainers."
    ].join("\n"),
    created_at: "2026-07-21T07:40:00.000Z",
    html_url: "https://github.com/adeyemimayokun/awalogo/issues/101",
    labels: [{ name: "logo-request" }, { name: "request-approved" }],
    number: 101,
    state: "open",
    title: "Logo request: Kuda Business",
    updated_at: "2026-07-28T16:05:00.000Z",
    user: { avatar_url: "", login: "local-contributor" }
  }]
]);
const localNotifications = new Map<string, RepositoryNotification>([
  ["9003", {
    id: "9003",
    reason: "mention",
    repository: { full_name: "adeyemimayokun/awalogo", html_url: "https://github.com/adeyemimayokun/awalogo" },
    subject: {
      latest_comment_url: null,
      title: "Logo request: Nomba",
      type: "Issue",
      url: "https://api.github.com/repos/adeyemimayokun/awalogo/issues/104"
    },
    unread: true,
    updated_at: "2026-07-30T18:42:00.000Z",
    url: "https://api.github.com/notifications/threads/9003"
  }],
  ["9002", {
    id: "9002",
    reason: "review_requested",
    repository: { full_name: "adeyemimayokun/awalogo", html_url: "https://github.com/adeyemimayokun/awalogo" },
    subject: {
      latest_comment_url: null,
      title: "Add VFD Microfinance Bank wordmark",
      type: "PullRequest",
      url: "https://api.github.com/repos/adeyemimayokun/awalogo/pulls/98"
    },
    unread: true,
    updated_at: "2026-07-29T12:15:00.000Z",
    url: "https://api.github.com/notifications/threads/9002"
  }],
  ["9001", {
    id: "9001",
    reason: "subscribed",
    repository: { full_name: "adeyemimayokun/awalogo", html_url: "https://github.com/adeyemimayokun/awalogo" },
    subject: {
      latest_comment_url: null,
      title: "Logo validation workflow completed",
      type: "CheckSuite",
      url: null
    },
    unread: false,
    updated_at: "2026-07-28T08:04:00.000Z",
    url: "https://api.github.com/notifications/threads/9001"
  }]
]);
const repositoryRoot = process.cwd().endsWith("apps/web") ? resolve(process.cwd(), "../..") : process.cwd();

export function isLocalRepositoryMode(): boolean {
  return process.env.AWALOGO_LOCAL_ADMIN_BYPASS === "1" &&
    !process.env.VERCEL;
}

function localPath(path: string): string {
  const resolved = resolve(repositoryRoot, path);
  if (!resolved.startsWith(`${repositoryRoot}/`)) throw new Error("Invalid local repository path");
  return resolved;
}

export async function readRepositoryFile(path: string): Promise<Buffer | null> {
  if (localChanges.has(path)) return localChanges.get(path) ?? null;
  return readFile(localPath(path));
}

function repository(): { owner: string; repo: string } {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "adeyemimayokun/awalogo").split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPOSITORY must use owner/repository format");
  return { owner, repo };
}

function token(): string {
  if (!process.env.GITHUB_ADMIN_TOKEN) throw new Error("Missing required environment variable: GITHUB_ADMIN_TOKEN");
  return process.env.GITHUB_ADMIN_TOKEN;
}

async function github<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      "User-Agent": "awalogo-cms",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub request failed (${response.status}): ${detail.slice(0, 240)}`);
  }
  if (response.status === 204 || response.status === 205) return undefined as T;
  return response.json() as Promise<T>;
}

export async function readRepositoryJson<T>(path: string): Promise<T> {
  if (isLocalRepositoryMode()) {
    const content = await readRepositoryFile(path);
    if (!content) throw new Error(`Local repository file was removed: ${path}`);
    return JSON.parse(content.toString("utf8")) as T;
  }
  const { owner, repo } = repository();
  const branch = process.env.GITHUB_DEFAULT_BRANCH ?? "main";
  const file = await github<GitHubContent>(`/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);
  if (file.encoding !== "base64") throw new Error(`Unsupported GitHub encoding for ${path}`);
  return JSON.parse(Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8")) as T;
}

export async function createRepositoryIssue(options: {
  title: string;
  body: string;
  labels?: string[];
}): Promise<RepositoryIssue> {
  if (isLocalRepositoryMode()) {
    const number = Math.max(0, ...localIssues.keys()) + 1;
    const now = new Date().toISOString();
    const issue: RepositoryIssue = {
      body: options.body,
      created_at: now,
      html_url: `https://github.com/adeyemimayokun/awalogo/issues/${number}`,
      labels: (options.labels ?? []).map((name) => ({ name })),
      number,
      state: "open",
      title: options.title,
      updated_at: now,
      user: { avatar_url: "", login: "local-contributor" }
    };
    localIssues.set(number, issue);
    return issue;
  }
  const { owner, repo } = repository();
  return github<RepositoryIssue>(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: options.title,
      body: options.body,
      labels: options.labels ?? []
    })
  });
}

export async function listRepositoryIssues(label: string): Promise<RepositoryIssue[]> {
  if (isLocalRepositoryMode()) {
    return [...localIssues.values()]
      .filter((issue) => issue.labels.some((item) => item.name === label))
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
  }
  const { owner, repo } = repository();
  const issues = await github<RepositoryIssue[]>(
    `/repos/${owner}/${repo}/issues?state=all&labels=${encodeURIComponent(label)}&sort=created&direction=desc&per_page=100`
  );
  return issues.filter((issue) => !issue.pull_request);
}

export async function updateRepositoryIssue(options: {
  number: number;
  labels: string[];
  state: "open" | "closed";
}): Promise<RepositoryIssue> {
  if (isLocalRepositoryMode()) {
    const current = localIssues.get(options.number);
    if (!current) throw new Error(`Logo request #${options.number} was not found`);
    const updated: RepositoryIssue = {
      ...current,
      labels: options.labels.map((name) => ({ name })),
      state: options.state,
      updated_at: new Date().toISOString()
    };
    localIssues.set(options.number, updated);
    return updated;
  }
  const { owner, repo } = repository();
  return github<RepositoryIssue>(`/repos/${owner}/${repo}/issues/${options.number}`, {
    method: "PATCH",
    body: JSON.stringify({ labels: options.labels, state: options.state })
  });
}

export async function listRepositoryNotifications(): Promise<RepositoryNotification[]> {
  if (isLocalRepositoryMode()) {
    return [...localNotifications.values()].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  }
  const { owner, repo } = repository();
  const fullName = `${owner}/${repo}`.toLowerCase();
  const notifications = await github<RepositoryNotification[]>("/notifications?all=true&participating=false&per_page=100");
  return notifications.filter((notification) => notification.repository.full_name.toLowerCase() === fullName);
}

export async function markRepositoryNotificationRead(id: string): Promise<void> {
  if (isLocalRepositoryMode()) {
    const current = localNotifications.get(id);
    if (!current) throw new Error(`Notification ${id} was not found`);
    localNotifications.set(id, { ...current, unread: false });
    return;
  }
  await github<void>(`/notifications/threads/${encodeURIComponent(id)}`, { method: "PATCH" });
}

function branchName(action: string, slug: string): string {
  const suffix = randomBytes(3).toString("hex");
  return `cms/${action}-${slug}-${Date.now()}-${suffix}`.slice(0, 240);
}

export async function createCatalogPullRequest(options: {
  action: string;
  slug: string;
  title: string;
  body: string;
  changes: FileChange[];
}): Promise<PullRequest> {
  if (isLocalRepositoryMode()) {
    for (const change of options.changes) localChanges.set(change.path, change.content);
    return { html_url: "", number: 0, local: true };
  }
  const { owner, repo } = repository();
  const base = process.env.GITHUB_DEFAULT_BRANCH ?? "main";
  const ref = await github<GitRef>(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(base)}`);
  const commit = await github<GitCommit>(`/repos/${owner}/${repo}/git/commits/${ref.object.sha}`);

  const entries = await Promise.all(options.changes.map(async (change) => {
    if (change.content === null) return { path: change.path, mode: "100644", type: "blob", sha: null };
    const blob = await github<GitBlob>(`/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: change.content.toString("base64"), encoding: "base64" })
    });
    return { path: change.path, mode: "100644", type: "blob", sha: blob.sha };
  }));

  const tree = await github<GitBlob>(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: commit.tree.sha, tree: entries })
  });
  const nextCommit = await github<GitBlob>(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message: options.title, tree: tree.sha, parents: [ref.object.sha] })
  });
  const head = branchName(options.action, options.slug);
  await github(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${head}`, sha: nextCommit.sha })
  });
  return github<PullRequest>(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title: options.title, body: options.body, head, base })
  });
}
