import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SessionType } from "./schema";

export type Language = "ko" | "en";

const STORAGE_KEY = "golflog:language";
const languages: Language[] = ["ko", "en"];

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readInitialLanguage(): Language {
  if (typeof window === "undefined") return "ko";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return languages.includes(stored as Language) ? (stored as Language) : "ko";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(readInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return value;
}

export function text(language: Language, ko: string, en: string) {
  return language === "en" ? en : ko;
}

export function localeFor(language: Language) {
  return language === "en" ? "en-US" : "ko-KR";
}

const sessionTypeLabels: Record<SessionType, Record<Language, string>> = {
  range: { ko: "연습장", en: "Range" },
  screen: { ko: "스크린", en: "Screen" },
  round: { ko: "라운드", en: "Round" },
  practice: { ko: "개인연습", en: "Practice" },
  lesson: { ko: "레슨", en: "Lesson" },
};

export function sessionTypeLabel(type: SessionType, language: Language) {
  return sessionTypeLabels[type][language];
}
