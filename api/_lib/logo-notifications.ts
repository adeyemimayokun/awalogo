import { createHash } from "node:crypto";
import { z } from "zod";

export const logoLiveNotificationSchema = z.object({
  institutionName: z.string().trim().min(2).max(120),
  recipientEmail: z.string().trim().email().max(254),
  logoUrl: z.string().url().refine(
    (value) => new URL(value).protocol === "https:",
    "Logo links must use HTTPS"
  ),
  submissionId: z.union([z.literal(""), z.string().uuid()]).optional().default("")
});

export type LogoLiveNotification = z.infer<typeof logoLiveNotificationSchema>;

export function logoLiveNotificationKey(input: LogoLiveNotification): string {
  const fingerprint = createHash("sha256")
    .update(`${input.recipientEmail.toLowerCase()}\0${input.logoUrl}`)
    .digest("hex")
    .slice(0, 24);
  return `logo-live-${fingerprint}`;
}
