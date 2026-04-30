import { CLUBS } from "./defaultData";
import { currentMonthKey } from "./dates";
import { localeFor, type Language } from "./i18n";
import type { AppData, Club, ClubShot, HealthEntry, Session } from "./schema";

export function formatSessionDate(date: string, language: Language = "ko") {
  const formatted = new Intl.DateTimeFormat(localeFor(language), {
    month: language === "en" ? "short" : "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
  return language === "en" ? formatted : formatted.replace(/\./g, "").trim();
}

export function latestWeight(data: AppData) {
  return [...data.healthEntries]
    .filter((entry) => typeof entry.weightKg === "number")
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1)?.weightKg;
}

export function sortedHealthEntries(data: AppData) {
  return [...data.healthEntries].sort((a, b) => a.date.localeCompare(b.date));
}

export function latestHealthEntry(data: AppData) {
  return sortedHealthEntries(data).at(-1);
}

export function weightTrend(data: AppData) {
  return sortedHealthEntries(data)
    .filter((entry) => typeof entry.weightKg === "number")
    .map((entry) => entry.weightKg as number);
}

export function sleepTrend(data: AppData) {
  return sortedHealthEntries(data)
    .filter((entry) => typeof entry.sleepHours === "number")
    .map((entry) => entry.sleepHours as number);
}

export function systolicTrend(data: AppData) {
  return sortedHealthEntries(data)
    .filter((entry) => typeof entry.systolic === "number")
    .map((entry) => entry.systolic as number);
}

export function diastolicTrend(data: AppData) {
  return sortedHealthEntries(data)
    .filter((entry) => typeof entry.diastolic === "number")
    .map((entry) => entry.diastolic as number);
}

export function bmi(data: AppData) {
  const weight = latestWeight(data);
  if (!weight) return undefined;
  const heightM = data.profile.heightCm / 100;
  return weight / (heightM * heightM);
}

function scoreBmi(value?: number) {
  if (!value) return 0;
  if (value >= 18.5 && value <= 25) return 10;
  const target = value < 18.5 ? 18.5 : 25;
  return clampScore(10 - Math.abs(value - target) * 1.6);
}

function scoreSleep(value?: number) {
  if (!value) return 0;
  return clampScore((value / 7.5) * 10);
}

function scoreBp(entry?: HealthEntry) {
  if (!entry?.systolic || !entry.diastolic) return 0;
  const sysPenalty = Math.abs(entry.systolic - 118) / 4;
  const diaPenalty = Math.abs(entry.diastolic - 76) / 3;
  return clampScore(10 - sysPenalty - diaPenalty);
}

function scoreActivity(data: AppData) {
  const activeDays = new Set(data.sessions.map((session) => session.date)).size;
  return clampScore((activeDays / 12) * 10);
}

function scoreWeightStability(data: AppData) {
  const recentWeights = weightTrend(data).slice(-14);
  if (recentWeights.length < 2) return 0;
  const mean = recentWeights.reduce((sum, value) => sum + value, 0) / recentWeights.length;
  const variance = recentWeights.reduce((sum, value) => sum + (value - mean) ** 2, 0) / recentWeights.length;
  const deviation = Math.sqrt(variance);
  return clampScore(10 - deviation * 5);
}

export function healthRadarValues(data: AppData) {
  const latest = latestHealthEntry(data);
  return [
    scoreBmi(bmi(data)),
    scoreSleep(latest?.sleepHours),
    scoreBp(latest),
    scoreActivity(data),
    scoreWeightStability(data),
  ];
}

export function healthScore(data: AppData) {
  const values = healthRadarValues(data);
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10);
}

export function recentHealthRows(data: AppData, limit = 10, language: Language = "ko") {
  return sortedHealthEntries(data)
    .slice(-limit)
    .reverse()
    .map((entry) => ({
      ...entry,
      displayDate: formatSessionDate(entry.date, language),
    }));
}

export function bestCarry(data: AppData, club: Club) {
  return data.clubShots
    .filter((shot) => shot.club === club && typeof shot.carryM === "number")
    .reduce<number | undefined>((best, shot) => Math.max(best ?? 0, shot.carryM ?? 0), undefined);
}

export function carryTrend(data: AppData, club: Club) {
  const sessionsById = new Map(data.sessions.map((session) => [session.id, session]));
  return data.clubShots
    .filter((shot) => shot.club === club && typeof shot.carryM === "number")
    .map((shot) => ({ shot, session: sessionsById.get(shot.sessionId) }))
    .filter((entry): entry is { shot: ClubShot; session: Session } => Boolean(entry.session))
    .sort((a, b) => a.session.date.localeCompare(b.session.date))
    .map((entry) => entry.shot.carryM as number);
}

export function averageCarry(data: AppData, club: Club) {
  const values = data.clubShots
    .filter((shot) => shot.club === club && typeof shot.carryM === "number")
    .map((shot) => shot.carryM as number);

  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function latestClubShot(data: AppData, club: Club) {
  const sessionsById = new Map(data.sessions.map((session) => [session.id, session]));

  return data.clubShots
    .filter((shot) => shot.club === club && typeof shot.carryM === "number")
    .map((shot) => ({ shot, session: sessionsById.get(shot.sessionId) }))
    .filter((entry): entry is { shot: ClubShot; session: Session } => Boolean(entry.session))
    .sort((a, b) => b.session.date.localeCompare(a.session.date))
    .at(0);
}

export function clubCarrySummaries(data: AppData) {
  return CLUBS.map((club) => {
    const shots = data.clubShots.filter((shot) => shot.club === club && typeof shot.carryM === "number");
    const values = shots.map((shot) => shot.carryM as number);
    const best = values.length ? Math.max(...values) : undefined;
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
    const latest = latestClubShot(data, club);

    return {
      club,
      best,
      average,
      count: values.length,
      latestCarry: latest?.shot.carryM,
      latestDate: latest?.session.date,
      latestLocation: latest?.session.location,
    };
  });
}

export function recentClubShotRows(data: AppData, club: Club, limit = 6, language: Language = "ko") {
  const sessionsById = new Map(data.sessions.map((session) => [session.id, session]));

  return data.clubShots
    .filter((shot) => shot.club === club && typeof shot.carryM === "number")
    .map((shot) => ({ shot, session: sessionsById.get(shot.sessionId) }))
    .filter((entry): entry is { shot: ClubShot; session: Session } => Boolean(entry.session))
    .sort((a, b) => b.session.date.localeCompare(a.session.date))
    .slice(0, limit)
    .map(({ shot, session }) => ({
      id: shot.id,
      sessionId: session.id,
      date: formatSessionDate(session.date, language),
      type: session.type,
      carryM: shot.carryM,
      totalM: shot.totalM,
      ballSpeed: shot.ballSpeed,
      location: session.location ?? "-",
    }));
}

function average(values: Array<number | undefined>) {
  const numbers = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!numbers.length) return undefined;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(10, value));
}

export function screenShotRows(data: AppData, club: Club, limit = 8, language: Language = "ko") {
  const sessionsById = new Map(data.sessions.map((session) => [session.id, session]));

  return data.clubShots
    .map((shot) => ({ shot, session: sessionsById.get(shot.sessionId) }))
    .filter((entry): entry is { shot: ClubShot; session: Session } => Boolean(entry.session))
    .filter(({ shot, session }) => {
      if (session.type !== "screen" || shot.club !== club) return false;
      return Boolean(shot.ballSpeed || shot.headSpeed || shot.launchAngle || shot.backspin || shot.sidespin || shot.sideDeviationM || shot.carryM || shot.totalM);
    })
    .sort((a, b) => b.session.date.localeCompare(a.session.date))
    .slice(0, limit)
    .map(({ shot, session }) => ({
      id: shot.id,
      sessionId: session.id,
      date: formatSessionDate(session.date, language),
      location: session.location ?? "-",
      shot,
    }));
}

export function latestScreenShot(data: AppData, club: Club) {
  return screenShotRows(data, club, 1).at(0);
}

export function averageScreenShot(data: AppData, club: Club): Partial<ClubShot> | undefined {
  const rows = screenShotRows(data, club, 100);
  if (!rows.length) return undefined;

  return {
    club,
    ballSpeed: average(rows.map((row) => row.shot.ballSpeed)),
    headSpeed: average(rows.map((row) => row.shot.headSpeed)),
    launchAngle: average(rows.map((row) => row.shot.launchAngle)),
    backspin: average(rows.map((row) => row.shot.backspin)),
    sidespin: average(rows.map((row) => row.shot.sidespin)),
    sideDeviationM: average(rows.map((row) => row.shot.sideDeviationM)),
    carryM: average(rows.map((row) => row.shot.carryM)),
    totalM: average(rows.map((row) => row.shot.totalM)),
  };
}

export function shotDnaValues(shot?: Partial<ClubShot>) {
  if (!shot) return [0, 0, 0, 0, 0, 0, 0, 0];

  const smash = shot.ballSpeed && shot.headSpeed ? shot.ballSpeed / shot.headSpeed : undefined;

  return [
    clampScore(((shot.ballSpeed ?? 0) / 80) * 10),
    clampScore(((shot.headSpeed ?? 0) / 55) * 10),
    shot.launchAngle ? clampScore(10 - Math.abs(shot.launchAngle - 14) * 1.2) : 0,
    shot.backspin ? clampScore(10 - Math.abs(shot.backspin - 2600) / 300) : 0,
    smash ? clampScore(((smash - 1.2) / 0.32) * 10) : 0,
    typeof shot.sideDeviationM === "number" ? clampScore(10 - Math.abs(shot.sideDeviationM) * 0.8) : 0,
    clampScore(((shot.carryM ?? 0) / 260) * 10),
    clampScore(((shot.totalM ?? 0) / 285) * 10),
  ];
}

export function monthlySessions(data: AppData, month = currentMonthKey()) {
  return data.sessions.filter((session) => session.date.startsWith(month));
}

export function monthlyDurationHours(data: AppData, month = currentMonthKey()) {
  const minutes = monthlySessions(data, month).reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
  return minutes / 60;
}

export function recentRecordRows(data: AppData, language: Language = "ko") {
  const shotsBySession = new Map<string, Map<Club, number>>();
  for (const shot of data.clubShots) {
    if (!shot.carryM) continue;
    const sessionShots = shotsBySession.get(shot.sessionId) ?? new Map<Club, number>();
    sessionShots.set(shot.club, Math.max(sessionShots.get(shot.club) ?? 0, shot.carryM));
    shotsBySession.set(shot.sessionId, sessionShots);
  }

  return [...data.sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((session) => {
      const shots = shotsBySession.get(session.id);
      return {
        id: session.id,
        date: formatSessionDate(session.date, language),
        type: session.type,
        clubs: CLUBS.map((club) => shots?.get(club)),
        duration: session.durationMinutes ? `${session.durationMinutes}${language === "en" ? " min" : "분"}` : "-",
        location: session.location ?? "-",
      };
    });
}

export function sessionShots(data: AppData, sessionId: string) {
  return data.clubShots
    .filter((shot) => shot.sessionId === sessionId)
    .sort((a, b) => CLUBS.indexOf(a.club) - CLUBS.indexOf(b.club));
}

export function sessionDetail(data: AppData, sessionId: string) {
  const session = data.sessions.find((item) => item.id === sessionId);
  if (!session) return undefined;
  return {
    session,
    shots: sessionShots(data, sessionId),
  };
}

export function sessionBestCarry(data: AppData, sessionId: string) {
  return sessionShots(data, sessionId)
    .filter((shot) => typeof shot.carryM === "number")
    .reduce<number | undefined>((best, shot) => Math.max(best ?? 0, shot.carryM ?? 0), undefined);
}

export function practiceHeatmap(data: AppData, weeks = 12) {
  const values = Array.from({ length: weeks * 7 }, () => 0);
  const sorted = [...data.sessions].sort((a, b) => a.date.localeCompare(b.date)).slice(-(weeks * 7));

  sorted.forEach((session, index) => {
    values[index] = Math.min(4, Math.max(1, Math.round((session.durationMinutes ?? 45) / 30)));
  });

  return values;
}

export function calendarIntensityByDay(data: AppData, yearMonth: string) {
  const days = new Map<number, number>();
  for (const session of data.sessions) {
    if (!session.date.startsWith(yearMonth)) continue;
    const day = Number(session.date.slice(-2));
    days.set(day, (days.get(day) ?? 0) + Math.max(1, Math.round((session.durationMinutes ?? 45) / 45)));
  }
  return days;
}

export function calendarSessionSummaryByDay(data: AppData, yearMonth: string) {
  const days = new Map<number, { count: number; totalMinutes: number; firstSessionId: string }>();

  for (const session of data.sessions) {
    if (!session.date.startsWith(yearMonth)) continue;
    const day = Number(session.date.slice(-2));
    const current = days.get(day);
    days.set(day, {
      count: (current?.count ?? 0) + 1,
      totalMinutes: (current?.totalMinutes ?? 0) + (session.durationMinutes ?? 0),
      firstSessionId: current?.firstSessionId ?? session.id,
    });
  }

  return days;
}
