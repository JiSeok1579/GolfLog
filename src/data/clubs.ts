import type { Language } from "./i18n";

export const CLUBS = ["Driver", "Wood", "Hybrid", "4I", "5I", "6I", "7I", "8I", "9I", "PW", "AW", "SW"] as const;

export type ClubId = (typeof CLUBS)[number];

export const CLUB_GROUPS: Array<{ id: string; label: Record<Language, string>; clubs: ClubId[] }> = [
  { id: "driver", label: { ko: "드라이버 계열", en: "Driver family" }, clubs: ["Driver", "Wood", "Hybrid"] },
  { id: "iron", label: { ko: "아이언 계열", en: "Iron family" }, clubs: ["4I", "5I", "6I", "7I", "8I", "9I"] },
  { id: "wedge", label: { ko: "웨지 계열", en: "Wedge family" }, clubs: ["PW", "AW", "SW"] },
];

const CLUB_LABELS: Record<ClubId, Record<Language, string>> = {
  Driver: { ko: "드라이버", en: "Driver" },
  Wood: { ko: "우드", en: "Wood" },
  Hybrid: { ko: "하이브리드", en: "Hybrid" },
  "4I": { ko: "4I", en: "4I" },
  "5I": { ko: "5I", en: "5I" },
  "6I": { ko: "6I", en: "6I" },
  "7I": { ko: "7I", en: "7I" },
  "8I": { ko: "8I", en: "8I" },
  "9I": { ko: "9I", en: "9I" },
  PW: { ko: "PW", en: "PW" },
  AW: { ko: "어프로치(AW)", en: "Approach (AW)" },
  SW: { ko: "SW", en: "SW" },
};

export function clubGroupLabel(group: (typeof CLUB_GROUPS)[number], language: Language = "ko") {
  return group.label[language];
}

export function clubLabel(club: ClubId, language: Language = "ko") {
  return CLUB_LABELS[club][language];
}

export function normalizeClubName(value: unknown): ClubId | undefined {
  if (typeof value !== "string") return undefined;
  if ((CLUBS as readonly string[]).includes(value)) return value as ClubId;

  const legacyMap: Record<string, ClubId> = {
    "3W": "Wood",
    52: "AW",
    56: "SW",
  };
  return legacyMap[value];
}
