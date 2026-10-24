import { describe, it, expect } from "vitest";
import { adminResources } from "./admin-resources";
import {
  filterResources,
  readFilters,
  writeFilters,
} from "../../packages/admin/resources";
import { productEventSchema } from "../../packages/admin/events";
describe("unified admin resources", () => {
  const resources = adminResources();
  it("keeps collection and artwork identities unique", () => {
    expect(new Set(resources.map((r) => r.id)).size).toBe(resources.length);
    expect(resources.some((r) => r.collection === "flag")).toBe(true);
    expect(resources.some((r) => r.collection === "company")).toBe(true);
    expect(resources.some((r) => r.history === "historical")).toBe(true);
  });
  it("combines filters with AND, selections with OR, and actual artwork formats", () => {
    const rows = filterResources(resources, {
      collection: ["flag", "company"],
      format: ["svg"],
      history: ["historical"],
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every(
        (r) =>
          r.collection === "company" &&
          r.formats.some((f) => f.type === "svg") &&
          r.history === "historical",
      ),
    ).toBe(true);
    expect(
      filterResources(resources, { kind: ["flag"], format: ["jpeg"] }),
    ).toHaveLength(0);
  });
  it("supports unknown geography without treating markets as origin", () => {
    const rows = filterResources(resources, {
      origin: ["unknown"],
      market: ["NG"],
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((r) => r.origin === null && r.markets.includes("NG")),
    ).toBe(true);
  });
  it("searches IDs, aliases and country codes", () => {
    const record = resources.find((r) => r.collection === "company")!;
    expect(
      filterResources(resources, { query: record.id }).map((r) => r.id),
    ).toContain(record.id);
    expect(
      filterResources(resources, { kind: ["flag"], query: "NG" }).length,
    ).toBeGreaterThan(0);
  });
  it("restores all URL filter values and preserves navigation", () => {
    const filters = {
      format: ["svg", "png"],
      market: ["NG", "GH"],
      query: "T2",
      page: 3,
      sort: "name-desc",
    };
    const query = writeFilters(filters, "section=assets");
    expect(new URLSearchParams(query).get("section")).toBe("assets");
    expect(readFilters(query)).toMatchObject(filters);
  });
});
describe("product payload privacy", () => {
  it("rejects free-text and unexpected personal fields", () => {
    const base = {
      id: "39b54fc7-7ce2-410d-8a2d-f0235cae893a",
      event: "search",
    };
    expect(
      productEventSchema.safeParse({ ...base, query: "private text" }).success,
    ).toBe(false);
    expect(
      productEventSchema.safeParse({ ...base, detail: "someone@example.com" })
        .success,
    ).toBe(false);
    expect(
      productEventSchema.safeParse({ ...base, detail: "1-10" }).success,
    ).toBe(true);
  });
});
