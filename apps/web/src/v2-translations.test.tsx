import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { isLanguage, languages, messages, translate } from "./v2-translations";
import { V2LanguageProvider, useV2Language } from "./V2Language";

describe("V2 languages", () => {
  it("supports English and the four requested Nigerian languages", () => {
    expect(languages.map((item) => item.code)).toEqual(["en", "ha", "yo", "ig", "pcm"]);
    expect(isLanguage("fr")).toBe(false);
    expect(isLanguage(null)).toBe(false);
    expect(isLanguage("yo")).toBe(true);
  });
  it("has complete translations and matching interpolation tokens", () => {
    for (const [key, entries] of Object.entries(messages)) {
      expect(entries).toHaveLength(4);
      const tokens = (value: string) => [...value.matchAll(/\{\w+\}/g)].map(([token]) => token).sort();
      for (const entry of entries) {
        expect(entry.trim().length, key).toBeGreaterThan(0);
        expect(tokens(entry), key).toEqual(tokens(key));
      }
    }
  });
  it("preserves names, code and URLs, with a readable English fallback", () => {
    for (const { code } of languages) {
      expect(translate(code, "View {name}", { name: "Guaranty Trust Bank" })).toContain("Guaranty Trust Bank");
      expect(translate(code, '<img src="https://awalogo.com/logo.svg" />')).toBe('<img src="https://awalogo.com/logo.svg" />');
      expect(translate(code, "An unknown server error")).toBe("An unknown server error");
    }
  });
  it("translates normalized category labels without changing filter values", () => {
    expect(translate("yo", "commercial bank")).toBe(translate("yo", "Commercial Bank"));
    expect(translate("ha", "{count} selected", { count: 2 })).toBe("An zaɓi 2");
  });
  it("defaults to English without browser storage", () => {
    function Sample() { const { t, language } = useV2Language(); return <span lang={language}>{t("Browse")}</span>; }
    expect(renderToStaticMarkup(<V2LanguageProvider><Sample /></V2LanguageProvider>)).toBe('<span lang="en">Browse</span>');
  });
});
