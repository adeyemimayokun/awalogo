import { describe, expect, it } from "vitest";
import { parsePack } from "./pack";
describe("plugin collection persistence", () => {
  it("rejects invalid storage and removes duplicate identities", () => {
    expect(parsePack("garbage")).toEqual([]);
    expect(parsePack("{}")).toEqual([]);
    expect(parsePack(JSON.stringify([{ slug: "bank", name: "Bank", svg: "untrusted" }, { slug: "bank", name: "Duplicate" }, null, { slug: "../bad", name: "Bad" }]))).toEqual([{ slug: "bank", name: "Bank" }]);
  });
  it("bounds the collection and preserves historical asset identities", () => {
    expect(parsePack(JSON.stringify(Array.from({ length: 100 }, (_, n) => ({ slug: `bank-${n}`, name: "Bank" }))))).toHaveLength(50);
    expect(parsePack('[{"slug":"bank-previous","name":"Previous logo"}]')[0].slug).toBe("bank-previous");
  });
});
