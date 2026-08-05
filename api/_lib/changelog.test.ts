import { describe, expect, it } from "vitest";
import { applyChangelogMutation, changelogMutationSchema } from "./changelog.js";

const existing = [{
  version: "v1.0.0",
  title: "Initial release",
  date: "2026-07-19",
  changes: ["Launched the searchable Nigerian financial logo catalog."],
  status: "published" as const,
  created_at: "2026-07-19",
  updated_at: "2026-07-19"
}];

describe("changelog mutations", () => {
  it("creates and sorts a major release", () => {
    const releases = applyChangelogMutation(existing, {
      operation: "create",
      version: "v2.0.0",
      title: "Admin publishing",
      date: "2026-08-05",
      changes: ["Added repository-backed changelog publishing."],
      status: "published"
    }, "2026-08-05");

    expect(releases.map((release) => release.version)).toEqual(["v2.0.0", "v1.0.0"]);
    expect(releases[0]).toMatchObject({ created_at: "2026-08-05", updated_at: "2026-08-05" });
  });

  it("edits release notes without changing the creation date", () => {
    const releases = applyChangelogMutation(existing, {
      operation: "update",
      version: "v1.0.0",
      title: "Initial public release",
      date: "2026-07-20",
      changes: ["Published the first searchable logo catalog."],
      status: "published"
    }, "2026-08-05");

    expect(releases[0]).toMatchObject({ title: "Initial public release", created_at: "2026-07-19", updated_at: "2026-08-05" });
  });

  it("rejects minor or patch versions", () => {
    expect(() => changelogMutationSchema.parse({
      operation: "create",
      version: "v1.1.0",
      title: "Minor release",
      date: "2026-08-05",
      changes: ["This release must not be accepted."],
      status: "draft"
    })).toThrow("Version must be a major release");
  });

  it("requires at least one release note", () => {
    expect(() => changelogMutationSchema.parse({
      operation: "create",
      version: "v2.0.0",
      title: "Empty release",
      date: "2026-08-05",
      changes: [],
      status: "draft"
    })).toThrow();
  });

  it("requires typed confirmation before deletion", () => {
    expect(() => applyChangelogMutation(existing, {
      operation: "delete",
      version: "v1.0.0",
      confirmation: "wrong"
    })).toThrow("Confirmation does not match");
  });

  it("rejects duplicate release versions in repository data", () => {
    expect(() => applyChangelogMutation([...existing, { ...existing[0] }], {
      operation: "delete",
      version: "v1.0.0",
      confirmation: "v1.0.0"
    })).toThrow("Duplicate changelog version");
  });
});
