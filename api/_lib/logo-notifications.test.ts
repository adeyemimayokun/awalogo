import { describe, expect, it } from "vitest";
import {
  logoLiveNotificationKey,
  logoLiveNotificationSchema
} from "./logo-notifications.js";

describe("logo live notifications", () => {
  it("validates a private recipient and creates a stable idempotency key", () => {
    const notification = logoLiveNotificationSchema.parse({
      institutionName: "Example Finance",
      recipientEmail: "Designer@Example.com",
      logoUrl: "https://awalogo.com/",
      submissionId: ""
    });

    expect(logoLiveNotificationKey(notification)).toBe(logoLiveNotificationKey({
      ...notification,
      recipientEmail: "designer@example.com"
    }));
    expect(logoLiveNotificationKey(notification)).toMatch(/^logo-live-[a-f0-9]{24}$/);
  });

  it("rejects non-HTTPS logo links", () => {
    expect(() => logoLiveNotificationSchema.parse({
      institutionName: "Example Finance",
      recipientEmail: "designer@example.com",
      logoUrl: "http://awalogo.com/"
    })).toThrow();
  });
});
