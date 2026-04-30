import type { AppData, NewSwingAnalysisInput, SwingAnalysisResult, SwingAnalysisStatus, SwingPose2DFrame } from "./schema";

export type ApiUser = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
};

type AuthenticatedResponse = {
  authenticated: true;
  user: ApiUser;
  data: AppData;
};

type AnonymousResponse = {
  authenticated: false;
};

export type AuthResponse = AuthenticatedResponse | AnonymousResponse;

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok) {
    throw Object.assign(new Error("Request failed"), { status: response.status, body });
  }
  return body;
}

export async function fetchCurrentUser() {
  const response = await fetch("/api/me", {
    credentials: "include",
  });
  return parseJson<AuthResponse>(response);
}

export async function registerDevice(input: { name: string; phone: string }) {
  const response = await fetch("/api/register", {
    body: JSON.stringify(input),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  return parseJson<AuthenticatedResponse>(response);
}

export async function loginDevice(input: { name: string; phone: string }) {
  const response = await fetch("/api/login", {
    body: JSON.stringify(input),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  return parseJson<AuthenticatedResponse>(response);
}

export async function saveAppData(data: AppData) {
  const response = await fetch("/api/data", {
    body: JSON.stringify({ data }),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
  });
  return parseJson<{ data: AppData }>(response);
}

export async function createSwingAnalysis(input: NewSwingAnalysisInput) {
  const response = await fetch("/api/analysis", {
    body: JSON.stringify(input),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  return parseJson<{ analysisId: string; status: SwingAnalysisStatus; result: SwingAnalysisResult }>(response);
}

export async function fetchSwingAnalysis(analysisId: string) {
  const response = await fetch(`/api/analysis/${encodeURIComponent(analysisId)}`, {
    credentials: "include",
  });
  return parseJson<{ result: SwingAnalysisResult }>(response);
}

export async function fetchSwingAnalysisStatus(analysisId: string) {
  const response = await fetch(`/api/analysis/${encodeURIComponent(analysisId)}/status`, {
    credentials: "include",
  });
  return parseJson<{ analysisId: string; status: SwingAnalysisStatus }>(response);
}

export async function fetchSwingAnalysisFrame(analysisId: string, frame: number) {
  const response = await fetch(`/api/analysis/${encodeURIComponent(analysisId)}/frames/${frame}`, {
    credentials: "include",
  });
  return parseJson<{ frame: SwingPose2DFrame }>(response);
}

export function apiErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const body = (error as { body?: unknown }).body;
  if (!body || typeof body !== "object") return "";
  const code = (body as { error?: unknown }).error;
  return typeof code === "string" ? code : "";
}
