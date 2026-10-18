import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("V2 primary-action theme cascade", () => {
  it("keeps broad dark surface defaults at zero descendant specificity", () => {
    const css = readFileSync("apps/web/src/v2.css", "utf8");
    const surfaces = css.split("\n").find((line) => line.includes('[data-v2-theme="dark"]') && line.includes(".v2-actions button"));
    expect(surfaces).toContain(":where(");
    expect(surfaces).not.toContain(":is(");
    expect(surfaces).toContain("background:var(--surface)");
  });
});
