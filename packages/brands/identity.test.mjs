import { describe, expect, it } from "vitest";
import { identityCollision, normalizeIdentity } from "./identity.mjs";
describe("company identity collision guard", () => {
  const existing = [{ slug: "example-bank", name: "Example Bank Plc", aliases: ["EB Nigeria"] }];
  it("rejects normalized legal names and aliases", () => {
    expect(normalizeIdentity("Example Bank Limited")).toBe(normalizeIdentity("Example Bank Plc"));
    expect(identityCollision({ slug: "different", name: "Example Bank Limited" }, existing)).toBe(existing[0]);
    expect(identityCollision({ slug: "different", name: "New Name", aliases: ["EB Nigeria"] }, existing)).toBe(existing[0]);
  });
  it("allows distinct companies without rewriting existing entries", () => {
    const before = JSON.stringify(existing);
    expect(identityCollision({ slug: "other", name: "Other Company" }, existing)).toBeUndefined();
    expect(JSON.stringify(existing)).toBe(before);
  });
});
