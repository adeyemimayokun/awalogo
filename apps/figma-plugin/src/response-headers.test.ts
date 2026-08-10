import { describe, expect, it } from "vitest";
import { readResponseHeader } from "./response-headers";

describe("Figma response header compatibility", () => {
  it("reads headers from standard browser responses", () => {
    expect(readResponseHeader({ headers: { get: (name) => name === "etag" ? "catalog-v1" : null } }, "etag"))
      .toBe("catalog-v1");
  });

  it("tolerates Figma responses without a Headers implementation", () => {
    expect(readResponseHeader({}, "etag")).toBeUndefined();
    expect(readResponseHeader({ headers: {} }, "etag")).toBeUndefined();
  });
});
