import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isLanguage, LANGUAGE_KEY, translate, type Language } from "./v2-translations";

const LanguageContext = createContext({ language: "en" as Language, setLanguage: (_language: Language) => {}, t: (key: string, values?: Record<string, string | number>) => translate("en", key, values) });

export function V2LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { const saved = localStorage.getItem(LANGUAGE_KEY); return isLanguage(saved) ? saved : "en"; } catch { return "en"; }
  });
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = language;
    try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* Language still works without storage. */ }
    return () => { document.documentElement.lang = previous; };
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (key: string, values?: Record<string, string | number>) => translate(language, key, values) }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useV2Language = () => useContext(LanguageContext);
