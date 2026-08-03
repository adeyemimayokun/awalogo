import { describe, expect, it } from "vitest";

import { usesDarkLogoPreview } from "./preview";

describe("logo preview contrast", () => {
  it("uses a dark preview surface for Anchor's official light logo", () => {
    expect(usesDarkLogoPreview("anchor")).toBe(true);
  });
});
