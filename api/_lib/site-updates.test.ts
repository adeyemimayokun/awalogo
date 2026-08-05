import { describe, expect, it } from "vitest";
import { applySiteUpdateMutation, siteUpdateMutationSchema } from "./site-updates.js";

const existing = [{
  id: "catalog-launch",
  title: "Catalog launch",
  summary: "The first public catalog is available.",
  published_at: "2026-08-01",
  action_label: "Browse logos",
  action_href: "/",
  status: "published" as const,
  created_at: "2026-08-01",
  updated_at: "2026-08-01"
}];

describe("site update mutations", () => {
  it("creates and deterministically sorts a published update", () => {
    const updates = applySiteUpdateMutation(existing, {
      operation: "create",
      id: "new-logos",
      title: "15 new logos added",
      summary: "A new batch of Nigerian financial logos is ready.",
      publishedAt: "2026-08-05",
      actionLabel: "View new logos",
      actionHref: "/?new=true",
      status: "published"
    }, "2026-08-05");

    expect(updates.map((update) => update.id)).toEqual(["new-logos", "catalog-launch"]);
    expect(updates[0]).toMatchObject({ created_at: "2026-08-05", updated_at: "2026-08-05" });
  });

  it("edits copy without changing the original creation date", () => {
    const updates = applySiteUpdateMutation(existing, {
      operation: "update",
      id: "catalog-launch",
      title: "Catalog now live",
      summary: "The public catalog is ready for designers and developers.",
      publishedAt: "2026-08-02",
      actionLabel: "Explore catalog",
      actionHref: "https://awalogo.com/",
      status: "published"
    }, "2026-08-05");

    expect(updates[0]).toMatchObject({ title: "Catalog now live", created_at: "2026-08-01", updated_at: "2026-08-05" });
  });

  it("requires explicit confirmation before deletion", () => {
    expect(() => applySiteUpdateMutation(existing, {
      operation: "delete",
      id: "catalog-launch",
      confirmation: "wrong-value"
    })).toThrow("Confirmation does not match");
  });

  it("rejects unsafe or malformed action links", () => {
    expect(() => siteUpdateMutationSchema.parse({
      operation: "create",
      id: "unsafe-link",
      title: "Unsafe link",
      summary: "This update should not be accepted.",
      publishedAt: "2026-08-05",
      actionLabel: "Open",
      actionHref: "javascript:alert(1)",
      status: "draft"
    })).toThrow("Action link must be a site path or HTTPS URL");

    expect(() => siteUpdateMutationSchema.parse({
      operation: "create",
      id: "protocol-relative-link",
      title: "Protocol-relative link",
      summary: "This link must not escape the awalogo website.",
      publishedAt: "2026-08-05",
      actionLabel: "Open",
      actionHref: "//example.com/path",
      status: "draft"
    })).toThrow("Action link must be a site path or HTTPS URL");
  });

  it("rejects impossible calendar dates", () => {
    expect(() => siteUpdateMutationSchema.parse({
      operation: "create",
      id: "invalid-date",
      title: "Invalid date",
      summary: "This date does not exist on the calendar.",
      publishedAt: "2026-02-31",
      actionLabel: "Open",
      actionHref: "/",
      status: "draft"
    })).toThrow("Date must be a valid calendar date");
  });
});
