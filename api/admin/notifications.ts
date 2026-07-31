import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { requireAdmin } from "../_lib/auth.js";
import {
  isLocalRepositoryMode,
  listRepositoryNotifications,
  markRepositoryNotificationRead,
  type RepositoryNotification
} from "../_lib/github.js";
import { jsonError, methodNotAllowed } from "../_lib/http.js";

const updateSchema = z.object({ id: z.string().min(1) });

function notificationUrl(notification: RepositoryNotification): string {
  const apiUrl = notification.subject.url;
  if (!apiUrl) return notification.repository.html_url;
  const match = apiUrl.match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/(issues|pulls)\/(\d+)$/);
  if (!match) return notification.repository.html_url;
  const [, owner, repo, kind, number] = match;
  return `https://github.com/${owner}/${repo}/${kind === "pulls" ? "pull" : "issues"}/${number}`;
}

function serializeNotification(notification: RepositoryNotification) {
  return {
    id: notification.id,
    title: notification.subject.title,
    type: notification.subject.type,
    reason: notification.reason,
    unread: notification.unread,
    updatedAt: notification.updated_at,
    url: notificationUrl(notification)
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET" && request.method !== "PATCH") return methodNotAllowed(response, ["GET", "PATCH"]);
  if (!requireAdmin(request, response)) return;

  try {
    if (request.method === "PATCH") {
      const update = updateSchema.parse(request.body);
      await markRepositoryNotificationRead(update.id);
    }
    const notifications = await listRepositoryNotifications();
    response.status(200).json({
      notifications: notifications.map(serializeNotification),
      localPreview: isLocalRepositoryMode()
    });
  } catch (error) {
    jsonError(response, error);
  }
}
