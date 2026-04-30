import { localeFor, type Language } from "./i18n";

const longDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const englishLongDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toMonthKey(date: Date) {
  return toDateKey(date).slice(0, 7);
}

export function todayDateKey() {
  return toDateKey(new Date());
}

export function currentMonthKey() {
  return toMonthKey(new Date());
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatLongDate(dateKey: string, language: Language = "ko") {
  const formatter = language === "en" ? englishLongDateFormatter : longDateFormatter;
  return formatter.format(new Date(`${dateKey}T00:00:00`));
}

export function formatMonthLabel(date: Date, language: Language = "ko") {
  return new Intl.DateTimeFormat(localeFor(language), { year: "numeric", month: "long" }).format(date);
}
