import { describe, expect, it, vi } from "vitest";
import type { LogoEntry } from "../../packages/logos/src/schema.js";
import {
  buildNotificationQueue,
  dispatchLogoNotifications,
  enrollLogoNotification,
  notificationRequestKey,
  notificationSegmentName
} from "./logo-notification-queue.js";
import type {
  AudienceContact,
  AudienceSegment,
  NotificationAudienceStore
} from "./resend-audience.js";

function logo(overrides: Partial<LogoEntry> = {}): LogoEntry {
  return {
    name: "Kuda",
    slug: "kuda-microfinance-bank",
    category: "microfinance-bank",
    aliases: ["Kuda Microfinance Bank Limited"],
    website: "https://kuda.com/",
    source_url: "https://kuda.com/",
    source_type: "official-website",
    source_path: "assets/kuda-microfinance-bank.svg",
    svg_path: "assets/kuda-microfinance-bank.svg",
    formats: [{
      type: "svg",
      path: "assets/kuda-microfinance-bank.svg",
      mime_type: "image/svg+xml",
      width: null,
      height: null
    }],
    added_at: "2026-07-13",
    updated_at: "2026-07-13",
    status: "verified",
    ...overrides
  };
}

function storeFixture(
  segments: AudienceSegment[] = [],
  contacts: Record<string, AudienceContact[]> = {}
): NotificationAudienceStore & {
  segments: AudienceSegment[];
  contacts: Record<string, AudienceContact[]>;
} {
  return {
    segments,
    contacts,
    async listSegments() {
      return this.segments;
    },
    async createSegment(name) {
      const segment = { id: crypto.randomUUID(), name };
      this.segments.push(segment);
      return segment;
    },
    async addContact(email, segmentId) {
      const current = this.contacts[segmentId] ?? [];
      if (!current.some((contact) => contact.email === email)) {
        current.push({ id: crypto.randomUUID(), email, unsubscribed: false });
      }
      this.contacts[segmentId] = current;
    },
    async listContacts(segmentId) {
      return this.contacts[segmentId] ?? [];
    },
    async removeContact(contactId, segmentId) {
      this.contacts[segmentId] = (this.contacts[segmentId] ?? [])
        .filter((contact) => contact.id !== contactId);
    },
    async deleteSegment(segmentId) {
      this.segments = this.segments.filter((segment) => segment.id !== segmentId);
      delete this.contacts[segmentId];
    }
  };
}

describe("logo notification queue", () => {
  it("normalizes request names and matches live aliases exactly", () => {
    expect(notificationRequestKey("  Kúdá & Co.  ")).toBe("kuda-and-co");
    const queue = buildNotificationQueue([
      {
        id: "segment-1",
        name: notificationSegmentName("Kuda Microfinance Bank Limited")
      }
    ], [logo()]);

    expect(queue).toMatchObject([{
      requestKey: "kuda-microfinance-bank-limited",
      status: "ready",
      matches: [{ slug: "kuda-microfinance-bank", name: "Kuda" }]
    }]);
  });

  it("keeps ambiguous and unmatched names out of automatic delivery", () => {
    const sharedAlias = "Example Finance";
    const queue = buildNotificationQueue([
      { id: "ambiguous", name: notificationSegmentName(sharedAlias) },
      { id: "unmatched", name: notificationSegmentName("Missing Wallet") }
    ], [
      logo({ slug: "example-one", aliases: [sharedAlias] }),
      logo({ slug: "example-two", aliases: [sharedAlias] })
    ]);

    expect(queue.find((item) => item.segmentId === "ambiguous")?.status).toBe("ambiguous");
    expect(queue.find((item) => item.segmentId === "unmatched")?.status).toBe("unmatched");
  });

  it("enrolls a private contact in a reusable institution segment", async () => {
    const store = storeFixture();
    const first = await enrollLogoNotification(store, {
      email: "Designer@Example.com",
      institutionName: "Kuda"
    });
    const second = await enrollLogoNotification(store, {
      email: "another@example.com",
      institutionName: "Kuda"
    });

    expect(first.segmentId).toBe(second.segmentId);
    expect(store.segments).toHaveLength(1);
    expect(store.contacts[first.segmentId]?.map((contact) => contact.email)).toEqual([
      "designer@example.com",
      "another@example.com"
    ]);
  });

  it("sends ready notifications once and removes the completed segment", async () => {
    const segment = {
      id: "segment-ready",
      name: notificationSegmentName("Kuda")
    };
    const store = storeFixture([segment], {
      [segment.id]: [
        { id: "contact-1", email: "requester@example.com", unsubscribed: false }
      ]
    });
    const send = vi.fn().mockResolvedValue(undefined);

    const result = await dispatchLogoNotifications(store, [logo()], { send });

    expect(send).toHaveBeenCalledWith(
      "requester@example.com",
      { institutionName: "Kuda", logoUrl: "https://awalogo.com/" },
      expect.stringMatching(/^logo-live-/)
    );
    expect(result).toMatchObject({ processedSegments: 1, notified: 1, failed: 0 });
    expect(store.segments).toHaveLength(0);
  });
});
