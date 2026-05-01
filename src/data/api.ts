import type { AppData, NewSwingAnalysisInput, SwingAnalysisResult, SwingAnalysisStatus, SwingPhase, SwingPose2DFrame } from "./schema";

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

export type SwingAnalysisStatusResponse = {
  analysisId: string;
  currentStage?: string;
  error?: string | null;
  progress?: number;
  status: SwingAnalysisStatus;
};

export type CreateSwingAnalysisResponse = SwingAnalysisStatusResponse & {
  result?: SwingAnalysisResult;
};

export type SwingAnalysisListItem = {
  createdAt: string;
  hasVideo: boolean;
  id: string;
  input: SwingAnalysisResult["input"];
  phaseCount: number;
  recommendationCount: number;
  scores: SwingAnalysisResult["scores"] | null;
  status: SwingAnalysisStatus;
  updatedAt: string;
  video: SwingAnalysisResult["video"] | null;
};

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

export async function createSwingAnalysis(input: NewSwingAnalysisInput & { videoFile?: File }) {
  if (input.videoFile) {
    const body = new FormData();
    body.append("video", input.videoFile);
    body.append("videoName", input.videoName);
    body.append("club", input.club);
    body.append("viewAngle", input.viewAngle);
    body.append("dominantHand", input.dominantHand);

    const response = await fetch("/api/analysis", {
      body,
      credentials: "include",
      method: "POST",
    });
    return parseJson<CreateSwingAnalysisResponse>(response);
  }

  const response = await fetch("/api/analysis", {
    body: JSON.stringify(input),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  return parseJson<CreateSwingAnalysisResponse>(response);
}

export async function fetchSwingAnalyses() {
  const response = await fetch("/api/analysis", {
    credentials: "include",
  });
  return parseJson<{ analyses: SwingAnalysisListItem[] }>(response);
}

export async function fetchSwingAnalysis(analysisId: string) {
  const response = await fetch(`/api/analysis/${encodeURIComponent(analysisId)}`, {
    credentials: "include",
  });
  return parseJson<{ result: SwingAnalysisResult }>(response);
}

export async function updateSwingAnalysisPhases(analysisId: string, phases: SwingPhase[]) {
  const response = await fetch(`/api/analysis/${encodeURIComponent(analysisId)}/phases`, {
    body: JSON.stringify({ phases }),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
  return parseJson<{ result: SwingAnalysisResult }>(response);
}

export async function updateSwingAnalysisClub(analysisId: string, input: { club: NonNullable<SwingPose2DFrame["club"]>; frame: number }) {
  const response = await fetch(`/api/analysis/${encodeURIComponent(analysisId)}/club`, {
    body: JSON.stringify(input),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
  return parseJson<{ result: SwingAnalysisResult }>(response);
}

export function swingAnalysisVideoUrl(analysisId: string) {
  return `/api/analysis/${encodeURIComponent(analysisId)}/video`;
}

export async function fetchSwingAnalysisStatus(analysisId: string) {
  const response = await fetch(`/api/analysis/${encodeURIComponent(analysisId)}/status`, {
    credentials: "include",
  });
  return parseJson<SwingAnalysisStatusResponse>(response);
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
