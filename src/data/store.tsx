import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { appDataSchema, type AppData, type NewClubShotInput, type NewHealthEntryInput, type NewSessionInput, type ProfileInput } from "./schema";
import { createInitialData, initialData } from "./defaultData";
import { normalizeClubName } from "./clubs";
import { SCREEN_GOLF_LOCATION } from "./constants";

const STORAGE_KEY = "golflog:data:v3";
const LEGACY_STORAGE_KEYS = ["golflog:data:v1", "golflog:data:v2"];

type GolfLogContextValue = {
  data: AppData;
  addSessionWithShots: (session: NewSessionInput, shots: NewClubShotInput[]) => string;
  updateSessionWithShots: (sessionId: string, session: NewSessionInput, shots: NewClubShotInput[]) => void;
  deleteSession: (sessionId: string) => void;
  addHealthEntry: (entry: NewHealthEntryInput) => string;
  updateProfile: (profile: ProfileInput) => void;
  resetData: () => void;
};

const GolfLogContext = createContext<GolfLogContextValue | null>(null);

function createId(prefix: string) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadData() {
  if (typeof window === "undefined") return initialData;

  LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialData;

  try {
    return appDataSchema.parse(migrateStoredData(JSON.parse(raw)));
  } catch {
    return initialData;
  }
}

function migrateStoredData(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const data = value as { clubShots?: unknown };
  const sessions = Array.isArray((value as { sessions?: unknown }).sessions)
    ? (value as { sessions: unknown[] }).sessions.map((session) => {
        if (!session || typeof session !== "object") return session;
        const input = session as { location?: unknown };
        return input.location === "Fit24 츠쿠바" ? { ...input, location: SCREEN_GOLF_LOCATION } : input;
      })
    : undefined;
  if (!Array.isArray(data.clubShots)) return sessions ? { ...data, sessions } : value;

  return {
    ...data,
    ...(sessions ? { sessions } : {}),
    clubShots: data.clubShots.map((shot) => {
      if (!shot || typeof shot !== "object") return shot;
      const input = shot as { club?: unknown };
      const club = normalizeClubName(input.club);
      return club ? { ...input, club } : input;
    }),
  };
}

type GolfLogProviderProps = {
  children: ReactNode;
};

export function GolfLogProvider({ children }: GolfLogProviderProps) {
  const [data, setData] = useState<AppData>(() => loadData());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const addSessionWithShots = useCallback((sessionInput: NewSessionInput, shotInputs: NewClubShotInput[]) => {
    const sessionId = createId("session");
    const session = { ...sessionInput, id: sessionId };
    const shots = shotInputs.map((shot) => ({
      ...shot,
      id: createId("shot"),
      sessionId,
    }));

    setData((current) =>
      appDataSchema.parse({
        ...current,
        sessions: [session, ...current.sessions],
        clubShots: [...shots, ...current.clubShots],
      }),
    );

    return sessionId;
  }, []);

  const updateSessionWithShots = useCallback((sessionId: string, sessionInput: NewSessionInput, shotInputs: NewClubShotInput[]) => {
    const session = { ...sessionInput, id: sessionId };
    const shots = shotInputs.map((shot) => ({
      ...shot,
      id: createId("shot"),
      sessionId,
    }));

    setData((current) => {
      if (!current.sessions.some((item) => item.id === sessionId)) return current;

      return appDataSchema.parse({
        ...current,
        sessions: current.sessions.map((item) => (item.id === sessionId ? session : item)),
        clubShots: [...shots, ...current.clubShots.filter((shot) => shot.sessionId !== sessionId)],
      });
    });
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setData((current) =>
      appDataSchema.parse({
        ...current,
        sessions: current.sessions.filter((session) => session.id !== sessionId),
        clubShots: current.clubShots.filter((shot) => shot.sessionId !== sessionId),
      }),
    );
  }, []);

  const addHealthEntry = useCallback((entryInput: NewHealthEntryInput) => {
    const entryId = createId("health");
    const entry = { ...entryInput, id: entryId };

    setData((current) =>
      appDataSchema.parse({
        ...current,
        healthEntries: [...current.healthEntries.filter((item) => item.date !== entry.date), entry],
      }),
    );

    return entryId;
  }, []);

  const updateProfile = useCallback((profileInput: ProfileInput) => {
    setData((current) =>
      appDataSchema.parse({
        ...current,
        profile: {
          ...current.profile,
          ...profileInput,
        },
      }),
    );
  }, []);

  const resetData = useCallback(() => {
    setData(createInitialData());
  }, []);

  const value = useMemo(
    () => ({ data, addSessionWithShots, updateSessionWithShots, deleteSession, addHealthEntry, updateProfile, resetData }),
    [addHealthEntry, addSessionWithShots, data, deleteSession, resetData, updateProfile, updateSessionWithShots],
  );

  return <GolfLogContext.Provider value={value}>{children}</GolfLogContext.Provider>;
}

export function useGolfLog() {
  const value = useContext(GolfLogContext);
  if (!value) {
    throw new Error("useGolfLog must be used inside GolfLogProvider");
  }
  return value;
}
