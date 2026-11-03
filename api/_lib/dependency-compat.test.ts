import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { buildMutationChanges, mutationSchema } from "./catalog.js";
import { publicLogoRequestSchema } from "./logo-requests.js";
import { productEventSchema } from "../../packages/admin/events.js";

describe("patched Zod schema compatibility", () => {
  it("preserves public request trimming and honeypot defaults", () => {
    const result = publicLogoRequestSchema.parse({
      submissionId: "12345678-1234-4234-8234-123456789abc",
      institutionName: "  Example Finance  ",
      officialWebsite: " https://example.com ",
      email: " designer@example.com ",
      category: "Fintech", logoAssetUrl: "", notifyWhenAvailable: false
    });
    expect(result).toMatchObject({ institutionName: "Example Finance", officialWebsite: "https://example.com", email: "designer@example.com", websiteConfirm: "" });
    expect(result).not.toHaveProperty("trackingToken");
  });

  it("preserves strict analytics fields and their defaults", () => {
    const input = { id: "12345678-1234-4234-8234-123456789abc", event: "download" };
    expect(productEventSchema.parse(input)).toEqual({ ...input, resource: "", format: "", detail: "" });
    expect(productEventSchema.safeParse({ ...input, email: "private@example.com" }).success).toBe(false);
  });

  it("rejects oversized mutation collections", () => {
    expect(mutationSchema.safeParse({
      operation: "edit-logo", slug: "example", name: "Example Finance",
      aliases: Array.from({ length: 21 }, () => "Alias"),
      website: "https://example.com", categories: ["fintech"]
    }).success).toBe(false);
  });

  it("validates record values before processing a catalog mutation", async () => {
    const mutation = mutationSchema.parse({ operation: "remove-logo", slug: "example", confirmation: "example" });
    await expect(buildMutationChanges(mutation, [], { example: "not-an-array" }, {
      version: 1, render_settings: {}, source_sha256: {}
    })).rejects.toBeInstanceOf(ZodError);
  });
});
