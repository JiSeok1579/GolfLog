import type { Language } from "./i18n";

export type JapanHoliday = {
  date: string;
  kind: "national" | "substitute" | "citizen";
  name: string;
};

type BaseHoliday = {
  day: number;
  month: number;
  name: Record<Language, string>;
};

const equinoxOverrides: Record<number, { autumnal: number; vernal: number }> = {
  2026: { autumnal: 23, vernal: 20 },
  2027: { autumnal: 23, vernal: 21 },
};

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toDateKey(date: Date) {
  return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, occurrence: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const offset = (weekday - firstDay + 7) % 7;
  return 1 + offset + (occurrence - 1) * 7;
}

function equinoxDay(year: number, type: "vernal" | "autumnal") {
  const override = equinoxOverrides[year]?.[type];
  if (override) return override;

  const base = type === "vernal" ? 20.8431 : 23.2488;
  return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function baseHolidays(year: number): BaseHoliday[] {
  return [
    { month: 1, day: 1, name: { ko: "신정", en: "New Year's Day" } },
    { month: 1, day: nthWeekdayOfMonth(year, 1, 1, 2), name: { ko: "성인의 날", en: "Coming of Age Day" } },
    { month: 2, day: 11, name: { ko: "건국기념일", en: "National Foundation Day" } },
    { month: 2, day: 23, name: { ko: "천황탄생일", en: "Emperor's Birthday" } },
    { month: 3, day: equinoxDay(year, "vernal"), name: { ko: "춘분의 날", en: "Vernal Equinox Day" } },
    { month: 4, day: 29, name: { ko: "쇼와의 날", en: "Showa Day" } },
    { month: 5, day: 3, name: { ko: "헌법기념일", en: "Constitution Memorial Day" } },
    { month: 5, day: 4, name: { ko: "녹색의 날", en: "Greenery Day" } },
    { month: 5, day: 5, name: { ko: "어린이날", en: "Children's Day" } },
    { month: 7, day: nthWeekdayOfMonth(year, 7, 1, 3), name: { ko: "바다의 날", en: "Marine Day" } },
    { month: 8, day: 11, name: { ko: "산의 날", en: "Mountain Day" } },
    { month: 9, day: nthWeekdayOfMonth(year, 9, 1, 3), name: { ko: "경로의 날", en: "Respect for the Aged Day" } },
    { month: 9, day: equinoxDay(year, "autumnal"), name: { ko: "추분의 날", en: "Autumnal Equinox Day" } },
    { month: 10, day: nthWeekdayOfMonth(year, 10, 1, 2), name: { ko: "스포츠의 날", en: "Sports Day" } },
    { month: 11, day: 3, name: { ko: "문화의 날", en: "Culture Day" } },
    { month: 11, day: 23, name: { ko: "근로감사의 날", en: "Labor Thanksgiving Day" } },
  ];
}

export function japanHolidaysByDate(year: number, language: Language = "ko") {
  const holidays = new Map<string, JapanHoliday>();
  const base = baseHolidays(year);
  const nationalHolidayKeys = new Set(base.map((holiday) => dateKey(year, holiday.month, holiday.day)));

  base.forEach((holiday) => {
    const key = dateKey(year, holiday.month, holiday.day);
    holidays.set(key, { date: key, kind: "national", name: holiday.name[language] });
  });

  base.forEach((holiday) => {
    const date = new Date(year, holiday.month - 1, holiday.day);
    if (date.getDay() !== 0) return;

    date.setDate(date.getDate() + 1);
    while (holidays.has(toDateKey(date))) {
      date.setDate(date.getDate() + 1);
    }

    const key = toDateKey(date);
    if (date.getFullYear() === year) {
      holidays.set(key, { date: key, kind: "substitute", name: language === "en" ? "Substitute Holiday" : "대체휴일" });
    }
  });

  for (let month = 1; month <= 12; month += 1) {
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = dateKey(year, month, day);
      if (holidays.has(key)) continue;

      const date = new Date(year, month - 1, day);
      const previousDate = new Date(date);
      const nextDate = new Date(date);
      previousDate.setDate(date.getDate() - 1);
      nextDate.setDate(date.getDate() + 1);

      if (nationalHolidayKeys.has(toDateKey(previousDate)) && nationalHolidayKeys.has(toDateKey(nextDate))) {
        holidays.set(key, { date: key, kind: "citizen", name: language === "en" ? "Citizen's Holiday" : "국민의 휴일" });
      }
    }
  }

  return holidays;
}
