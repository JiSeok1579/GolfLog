import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiErrorCode, fetchCurrentUser, loginDevice, registerDevice, saveAppData, type ApiUser } from "./api";
import { appDataSchema, type AppData, type NewClubShotInput, type NewHealthEntryInput, type NewSessionInput, type ProfileInput } from "./schema";
import { createInitialData, initialData } from "./defaultData";
import { normalizeClubName } from "./clubs";
import { SCREEN_GOLF_LOCATION } from "./constants";

const STORAGE_KEY = "golflog:data:v3";
const LEGACY_STORAGE_KEYS = ["golflog:data:v1", "golflog:data:v2"];

type GolfLogContextValue = {
  authStatus: "loading" | "needs-login" | "ready" | "error";
  data: AppData;
  loginUser: (input: { name: string; phone: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  registerUser: (input: { name: string; phone: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  serverError: string;
  user: ApiUser | null;
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

function clearStoredData() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
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
  const [authStatus, setAuthStatus] = useState<GolfLogContextValue["authStatus"]>("loading");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [serverError, setServerError] = useState("");
  const saveVersion = useRef(0);

  useEffect(() => {
    let off = false;

    fetchCurrentUser()
      .then((response) => {
        if (off) return;
        if (!response.authenticated) {
          setAuthStatus("needs-login");
          return;
        }

        setUser(response.user);
        setData(appDataSchema.parse(migrateStoredData(response.data)));
        clearStoredData();
        setServerError("");
        setAuthStatus("ready");
      })
      .catch(() => {
        if (off) return;
        setServerError("server_unavailable");
        setAuthStatus("error");
      });

    return () => {
      off = true;
    };
  }, []);

  const persistData = useCallback(
    (nextData: AppData) => {
      if (authStatus !== "ready") return;

      const version = saveVersion.current + 1;
      saveVersion.current = version;
      void saveAppData(nextData)
        .then((response) => {
          if (saveVersion.current !== version) return;
          setData(appDataSchema.parse(migrateStoredData(response.data)));
          setServerError("");
        })
        .catch(() => {
          if (saveVersion.current !== version) return;
          setServerError("sync_failed");
        });
    },
    [authStatus],
  );

  const registerUser = useCallback(async (input: { name: string; phone: string }) => {
    try {
      const response = await registerDevice(input);
      const migratedData = appDataSchema.parse({
        ...data,
        profile: {
          ...data.profile,
          id: response.user.id,
          name: response.user.name,
          phone: response.user.phone,
        },
      });
      const savedData = await saveAppData(migratedData)
        .then((saved) => appDataSchema.parse(migrateStoredData(saved.data)))
        .catch(() => null);

      setUser(response.user);
      setData(savedData || appDataSchema.parse(migrateStoredData(response.data)));
      clearStoredData();
      setServerError(savedData ? "" : "sync_failed");
      setAuthStatus("ready");
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: apiErrorCode(error) || "register_failed" };
    }
  }, [data]);

  const loginUser = useCallback(async (input: { name: string; phone: string }) => {
    try {
      const response = await loginDevice(input);
      setUser(response.user);
      setData(appDataSchema.parse(migrateStoredData(response.data)));
      clearStoredData();
      setServerError("");
      setAuthStatus("ready");
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: apiErrorCode(error) || "login_failed" };
    }
  }, []);

  const addSessionWithShots = useCallback((sessionInput: NewSessionInput, shotInputs: NewClubShotInput[]) => {
    const sessionId = createId("session");
    const session = { ...sessionInput, id: sessionId };
    const shots = shotInputs.map((shot) => ({
      ...shot,
      id: createId("shot"),
      sessionId,
    }));

    setData((current) => {
      const nextData = appDataSchema.parse({
        ...current,
        sessions: [session, ...current.sessions],
        clubShots: [...shots, ...current.clubShots],
      });
      persistData(nextData);
      return nextData;
    });

    return sessionId;
  }, [persistData]);

  const updateSessionWithShots = useCallback((sessionId: string, sessionInput: NewSessionInput, shotInputs: NewClubShotInput[]) => {
    const session = { ...sessionInput, id: sessionId };
    const shots = shotInputs.map((shot) => ({
      ...shot,
      id: createId("shot"),
      sessionId,
    }));

    setData((current) => {
      if (!current.sessions.some((item) => item.id === sessionId)) return current;

      const nextData = appDataSchema.parse({
        ...current,
        sessions: current.sessions.map((item) => (item.id === sessionId ? session : item)),
        clubShots: [...shots, ...current.clubShots.filter((shot) => shot.sessionId !== sessionId)],
      });
      persistData(nextData);
      return nextData;
    });
  }, [persistData]);

  const deleteSession = useCallback((sessionId: string) => {
    setData((current) => {
      const nextData = appDataSchema.parse({
        ...current,
        sessions: current.sessions.filter((session) => session.id !== sessionId),
        clubShots: current.clubShots.filter((shot) => shot.sessionId !== sessionId),
      });
      persistData(nextData);
      return nextData;
    });
  }, [persistData]);

  const addHealthEntry = useCallback((entryInput: NewHealthEntryInput) => {
    const entryId = createId("health");
    const entry = { ...entryInput, id: entryId };

    setData((current) => {
      const nextData = appDataSchema.parse({
        ...current,
        healthEntries: [...current.healthEntries.filter((item) => item.date !== entry.date), entry],
      });
      persistData(nextData);
      return nextData;
    });

    return entryId;
  }, [persistData]);

  const updateProfile = useCallback((profileInput: ProfileInput) => {
    setData((current) => {
      const nextData = appDataSchema.parse({
        ...current,
        profile: {
          ...current.profile,
          ...profileInput,
        },
      });
      persistData(nextData);
      return nextData;
    });
  }, [persistData]);

  const resetData = useCallback(() => {
    setData((current) => {
      const nextData = appDataSchema.parse({
        ...createInitialData(),
        profile: current.profile,
      });
      persistData(nextData);
      return nextData;
    });
  }, [persistData]);

  const value = useMemo(
    () => ({
      authStatus,
      data,
      loginUser,
      registerUser,
      serverError,
      user,
      addSessionWithShots,
      updateSessionWithShots,
      deleteSession,
      addHealthEntry,
      updateProfile,
      resetData,
    }),
    [addHealthEntry, addSessionWithShots, authStatus, data, deleteSession, loginUser, registerUser, resetData, serverError, updateProfile, updateSessionWithShots, user],
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
