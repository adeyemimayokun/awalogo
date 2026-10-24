import { describe, expect, it } from "vitest";
import { assetUrl } from "./asset-url";

describe("environment-aware asset snippets", () => {
  it.each(["https://nigerian-bank-logos-git-staging-ship-with-ai.vercel.app", "https://www.awalogo.com", "http://127.0.0.1:5181"])("uses the current deployment %s", (origin) => {
    for (const path of ["/catalog/v1/assets/logo.svg", "/catalog/v2/assets/logo.png", "/flags/v1/assets/flag.webp"]) expect(assetUrl(path, origin)).toBe(`${origin}${path}`);
  });
});
