const API_ROOT = "https://api.resend.com";
const USER_AGENT = "awalogo/1.0 (+https://awalogo.com)";

export type AudienceSegment = {
  id: string;
  name: string;
  createdAt?: string;
};

export type AudienceContact = {
  id: string;
  email: string;
  unsubscribed: boolean;
};

export interface NotificationAudienceStore {
  listSegments(): Promise<AudienceSegment[]>;
  createSegment(name: string): Promise<AudienceSegment>;
  addContact(email: string, segmentId: string): Promise<void>;
  listContacts(segmentId: string): Promise<AudienceContact[]>;
  removeContact(contactId: string, segmentId: string): Promise<void>;
  deleteSegment(segmentId: string): Promise<void>;
}

type ListResponse<T> = {
  data?: T[];
  has_more?: boolean;
};

let nextRequestAt = 0;

function requiredApiKey(): string {
  const value = process.env.RESEND_AUDIENCE_API_KEY?.trim();
  if (!value) {
    throw new Error(
      "Missing required environment variable: RESEND_AUDIENCE_API_KEY"
    );
  }
  return value;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function throttle(): Promise<void> {
  const delay = Math.max(0, nextRequestAt - Date.now());
  if (delay) await wait(delay);
  nextRequestAt = Date.now() + 550;
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  attempt = 0
): Promise<T> {
  await throttle();
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requiredApiKey()}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      ...init.headers
    }
  });

  if (response.status === 429 && attempt < 2) {
    const retryAfter = Number(response.headers.get("retry-after") ?? "1");
    await wait(Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000);
    return apiRequest<T>(path, init, attempt + 1);
  }

  const text = await response.text();
  if (!response.ok) {
    const error = new Error(
      `Resend audience request failed (${response.status}): ${text.slice(0, 240)}`
    );
    Object.assign(error, { status: response.status });
    throw error;
  }

  return (text ? JSON.parse(text) : {}) as T;
}

async function listAll<T extends { id: string }>(path: string): Promise<T[]> {
  const records: T[] = [];
  let after = "";

  do {
    const query = new URLSearchParams({ limit: "100" });
    if (after) query.set("after", after);
    const page = await apiRequest<ListResponse<T>>(`${path}?${query}`);
    const data = page.data ?? [];
    records.push(...data);
    after = page.has_more && data.length ? data[data.length - 1]!.id : "";
  } while (after);

  return records;
}

function statusOf(error: unknown): number | undefined {
  return error && typeof error === "object" && "status" in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
}

export const resendAudience: NotificationAudienceStore = {
  async listSegments() {
    const segments = await listAll<{
      id: string;
      name: string;
      created_at?: string;
    }>("/segments");
    return segments.map((segment) => ({
      id: segment.id,
      name: segment.name,
      createdAt: segment.created_at
    }));
  },

  async createSegment(name) {
    const segment = await apiRequest<{
      id: string;
      name: string;
    }>("/segments", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    return { id: segment.id, name: segment.name };
  },

  async addContact(email, segmentId) {
    try {
      await apiRequest("/contacts", {
        method: "POST",
        body: JSON.stringify({
          email,
          unsubscribed: false,
          segments: [{ id: segmentId }]
        })
      });
    } catch (error) {
      if (statusOf(error) !== 409) throw error;
      await apiRequest(
        `/contacts/${encodeURIComponent(email)}/segments/${encodeURIComponent(segmentId)}`,
        { method: "POST" }
      );
    }
  },

  async listContacts(segmentId) {
    const contacts = await listAll<{
      id: string;
      email: string;
      unsubscribed?: boolean;
    }>(`/segments/${encodeURIComponent(segmentId)}/contacts`);
    return contacts.map((contact) => ({
      id: contact.id,
      email: contact.email,
      unsubscribed: Boolean(contact.unsubscribed)
    }));
  },

  async removeContact(contactId, segmentId) {
    await apiRequest(
      `/contacts/${encodeURIComponent(contactId)}/segments/${encodeURIComponent(segmentId)}`,
      { method: "DELETE" }
    );
  },

  async deleteSegment(segmentId) {
    await apiRequest(`/segments/${encodeURIComponent(segmentId)}`, {
      method: "DELETE"
    });
  }
};
