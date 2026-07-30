import type { LogoEntry } from "../../packages/logos/src/schema.js";
import { sendLogoLiveNotification } from "./email.js";
import {
  logoLiveNotificationKey,
  type LogoLiveNotification
} from "./logo-notifications.js";
import type {
  AudienceSegment,
  NotificationAudienceStore
} from "./resend-audience.js";

const SEGMENT_PREFIX = "awalogo-logo-live:";

export type QueueMatchStatus = "ready" | "ambiguous" | "unmatched";

export type NotificationQueueItem = {
  segmentId: string;
  requestKey: string;
  requestedName: string;
  status: QueueMatchStatus;
  matches: Array<{ slug: string; name: string }>;
  createdAt?: string;
};

export type NotificationDispatchResult = {
  processedSegments: number;
  notified: number;
  skippedUnsubscribed: number;
  failed: number;
  ready: number;
  ambiguous: number;
  unmatched: number;
};

type NotificationSender = (
  recipientEmail: string,
  input: { institutionName: string; logoUrl: string },
  idempotencyKey: string
) => Promise<void>;

export function notificationRequestKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function notificationSegmentName(institutionName: string): string {
  const key = notificationRequestKey(institutionName);
  if (!key) throw new Error("The institution name cannot create a notification key");
  return `${SEGMENT_PREFIX}${key}`;
}

function titleFromKey(key: string): string {
  return key
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function notificationSegments(segments: AudienceSegment[]): AudienceSegment[] {
  return segments.filter((segment) => segment.name.startsWith(SEGMENT_PREFIX));
}

function matchKeys(logo: LogoEntry): Set<string> {
  return new Set(
    [logo.slug, logo.name, ...logo.aliases]
      .map(notificationRequestKey)
      .filter(Boolean)
  );
}

export function buildNotificationQueue(
  segments: AudienceSegment[],
  catalog: LogoEntry[]
): NotificationQueueItem[] {
  const catalogKeys = catalog.map((logo) => ({ logo, keys: matchKeys(logo) }));

  return notificationSegments(segments)
    .map((segment) => {
      const requestKey = segment.name.slice(SEGMENT_PREFIX.length);
      const matches = catalogKeys
        .filter(({ keys }) => keys.has(requestKey))
        .map(({ logo }) => ({ slug: logo.slug, name: logo.name }));
      return {
        segmentId: segment.id,
        requestKey,
        requestedName: titleFromKey(requestKey),
        status: matches.length === 1
          ? "ready" as const
          : matches.length > 1
            ? "ambiguous" as const
            : "unmatched" as const,
        matches,
        createdAt: segment.createdAt
      };
    })
    .sort((left, right) => left.requestedName.localeCompare(right.requestedName));
}

export async function enrollLogoNotification(
  store: NotificationAudienceStore,
  input: { email: string; institutionName: string }
): Promise<{ segmentId: string; requestKey: string }> {
  const name = notificationSegmentName(input.institutionName);
  const requestKey = name.slice(SEGMENT_PREFIX.length);
  const existing = (await store.listSegments()).find((segment) => segment.name === name);
  const segment = existing ?? await store.createSegment(name);
  await store.addContact(input.email.trim().toLowerCase(), segment.id);
  return { segmentId: segment.id, requestKey };
}

export async function getNotificationQueue(
  store: NotificationAudienceStore,
  catalog: LogoEntry[]
): Promise<NotificationQueueItem[]> {
  return buildNotificationQueue(await store.listSegments(), catalog);
}

function publicSiteUrl(): string {
  return (process.env.PUBLIC_SITE_URL?.trim() || "https://awalogo.com").replace(/\/+$/, "");
}

async function deliverSegment(
  store: NotificationAudienceStore,
  segment: NotificationQueueItem,
  logo: LogoEntry,
  send: NotificationSender
): Promise<Pick<NotificationDispatchResult, "notified" | "skippedUnsubscribed" | "failed">> {
  const contacts = await store.listContacts(segment.segmentId);
  const logoUrl = `${publicSiteUrl()}/`;
  let notified = 0;
  let skippedUnsubscribed = 0;
  let failed = 0;
  const deliveredContactIds: string[] = [];

  for (const contact of contacts) {
    if (contact.unsubscribed) {
      skippedUnsubscribed += 1;
      continue;
    }

    const notification: LogoLiveNotification = {
      institutionName: logo.name,
      recipientEmail: contact.email,
      logoUrl,
      submissionId: ""
    };
    try {
      await send(
        contact.email,
        { institutionName: logo.name, logoUrl },
        logoLiveNotificationKey(notification)
      );
      notified += 1;
      deliveredContactIds.push(contact.id);
    } catch (error) {
      failed += 1;
      console.error(`Logo-live email failed for segment ${segment.segmentId}`, error);
    }
  }

  if (failed === 0) {
    await store.deleteSegment(segment.segmentId);
  } else {
    for (const contactId of deliveredContactIds) {
      await store.removeContact(contactId, segment.segmentId);
    }
  }

  return { notified, skippedUnsubscribed, failed };
}

export async function dispatchLogoNotifications(
  store: NotificationAudienceStore,
  catalog: LogoEntry[],
  options: {
    segmentId?: string;
    logoSlug?: string;
    send?: NotificationSender;
  } = {}
): Promise<NotificationDispatchResult> {
  const queue = await getNotificationQueue(store, catalog);
  const send = options.send ?? sendLogoLiveNotification;
  const selected = options.segmentId
    ? queue.filter((item) => item.segmentId === options.segmentId)
    : queue.filter((item) => item.status === "ready");

  if (options.segmentId && selected.length !== 1) {
    throw new Error("The selected notification request no longer exists");
  }

  let notified = 0;
  let skippedUnsubscribed = 0;
  let failed = 0;
  let processedSegments = 0;

  for (const segment of selected) {
    const matchedSlug = options.segmentId
      ? options.logoSlug
      : segment.matches[0]?.slug;
    const logo = catalog.find((entry) => entry.slug === matchedSlug);
    if (!logo) {
      if (options.segmentId) throw new Error("Select a valid live logo");
      continue;
    }
    const delivered = await deliverSegment(store, segment, logo, send);
    processedSegments += 1;
    notified += delivered.notified;
    skippedUnsubscribed += delivered.skippedUnsubscribed;
    failed += delivered.failed;
  }

  return {
    processedSegments,
    notified,
    skippedUnsubscribed,
    failed,
    ready: queue.filter((item) => item.status === "ready").length,
    ambiguous: queue.filter((item) => item.status === "ambiguous").length,
    unmatched: queue.filter((item) => item.status === "unmatched").length
  };
}
