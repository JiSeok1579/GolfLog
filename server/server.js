import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { normalizeWorkerResult } from "./analysis/normalizeWorkerResult.js";
import { runPoseWorker } from "./analysis/runPoseWorker.js";
import { analysisPaths } from "./analysis/storage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const dataFile = process.env.GOLFLOG_DATA_FILE || join(rootDir, "server-data", "golflog.json");
const port = Number(process.env.GOLFLOG_API_PORT || 3001);
const cookieName = "golflog_device";
const cookieMaxAge = 60 * 60 * 24 * 400;
const validClubs = new Set(["Driver", "Wood", "Hybrid", "4I", "5I", "6I", "7I", "8I", "9I", "PW", "AW", "SW"]);
const validViewAngles = new Set(["down-the-line", "face-on"]);
const validDominantHands = new Set(["right", "left"]);
const swingPhaseOrder = ["address", "takeaway", "backswing_top", "downswing", "impact", "follow_through", "finish"];

function createId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function emptyStore() {
  return {
    version: 1,
    users: [],
    dataByUser: {},
    analysisJobsByUser: {},
    swingAnalysesByUser: {},
  };
}

function userDeviceHashes(user) {
  return Array.from(new Set([user.deviceIdHash, ...(Array.isArray(user.deviceIdHashes) ? user.deviceIdHashes : [])].filter(Boolean)));
}

function normalizeUser(user) {
  return {
    ...user,
    deviceIdHashes: userDeviceHashes(user),
  };
}

function initialData(user) {
  return {
    profile: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      heightCm: 175,
      distanceUnit: "m",
      weightUnit: "kg",
    },
    sessions: [],
    clubShots: [],
    healthEntries: [],
  };
}

function readStore() {
  if (!existsSync(dataFile)) return emptyStore();

  try {
    const store = JSON.parse(readFileSync(dataFile, "utf8"));
    return {
      version: 1,
      users: Array.isArray(store.users) ? store.users.map(normalizeUser) : [],
      analysisJobsByUser: store.analysisJobsByUser && typeof store.analysisJobsByUser === "object" ? store.analysisJobsByUser : {},
      dataByUser: store.dataByUser && typeof store.dataByUser === "object" ? store.dataByUser : {},
      swingAnalysesByUser: store.swingAnalysesByUser && typeof store.swingAnalysesByUser === "object" ? store.swingAnalysesByUser : {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  mkdirSync(dirname(dataFile), { recursive: true });
  const tmpFile = `${dataFile}.tmp`;
  writeFileSync(tmpFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  renameSync(tmpFile, dataFile);
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function setDeviceCookie(res, deviceId, req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const secure = process.env.GOLFLOG_COOKIE_SECURE === "1" || forwardedProto === "https";
  const parts = [
    `${cookieName}=${encodeURIComponent(deviceId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${cookieMaxAge}`,
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function videoContentType(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".webm") return "video/webm";
  if (extension === ".m4v") return "video/x-m4v";
  return "video/mp4";
}

function sendVideoFile(req, res, filePath) {
  const stat = statSync(filePath);
  const range = req.headers.range;
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Type": videoContentType(filePath),
  };

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match && match[1] ? Number(match[1]) : 0;
    const end = match && match[2] ? Number(match[2]) : stat.size - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= stat.size) {
      res.writeHead(416, {
        "Content-Range": `bytes */${stat.size}`,
        ...commonHeaders,
      });
      res.end();
      return;
    }

    res.writeHead(206, {
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      ...commonHeaders,
    });
    createReadStream(filePath, { end, start }).pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Length": stat.size,
    ...commonHeaders,
  });
  createReadStream(filePath).pipe(res);
}

function readJson(req) {
  return new Promise((resolveBody, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024 * 4) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function readBodyBuffer(req, maxBytes = 1024 * 1024 * 260) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(req, buffer) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return null;

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`, "latin1");
  const fields = {};
  const files = {};
  let position = buffer.indexOf(boundary);

  while (position !== -1) {
    position += boundary.length;
    if (buffer.slice(position, position + 2).toString("latin1") === "--") break;
    if (buffer.slice(position, position + 2).toString("latin1") === "\r\n") position += 2;

    const nextBoundary = buffer.indexOf(boundary, position);
    if (nextBoundary === -1) break;

    let part = buffer.slice(position, nextBoundary);
    if (part.slice(-2).toString("latin1") === "\r\n") part = part.slice(0, -2);

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n", "latin1"));
    if (headerEnd !== -1) {
      const headerText = part.slice(0, headerEnd).toString("latin1");
      const data = part.slice(headerEnd + 4);
      const nameMatch = headerText.match(/name="([^"]+)"/i);
      const fileNameMatch = headerText.match(/filename="([^"]*)"/i);
      const typeMatch = headerText.match(/content-type:\s*([^\r\n]+)/i);
      if (nameMatch) {
        const name = nameMatch[1];
        if (fileNameMatch) {
          files[name] = {
            contentType: typeMatch ? typeMatch[1].trim() : "application/octet-stream",
            data,
            fileName: fileNameMatch[1],
          };
        } else {
          fields[name] = data.toString("utf8");
        }
      }
    }

    position = nextBoundary;
  }

  return { fields, files };
}

function isMultipartRequest(req) {
  return String(req.headers["content-type"] || "").toLowerCase().startsWith("multipart/form-data");
}

function authFromRequest(req, store) {
  const cookies = parseCookies(req.headers.cookie);
  const deviceId = cookies[cookieName];
  if (!deviceId) return { deviceId: "", user: null };

  const deviceIdHash = hash(deviceId);
  const user = store.users.find((item) => userDeviceHashes(item).includes(deviceIdHash)) || null;
  return { deviceId, user };
}

function userMatchesLogin(user, name, phone) {
  return user.phone === phone && user.name.trim().toLowerCase() === name.trim().toLowerCase();
}

function attachDeviceToUser(user, deviceIdHash) {
  const hashes = Array.from(new Set([...userDeviceHashes(user), deviceIdHash]));
  return {
    ...user,
    deviceIdHash: user.deviceIdHash || deviceIdHash,
    deviceIdHashes: hashes,
  };
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    createdAt: user.createdAt,
  };
}

function validateAppData(value) {
  if (!value || typeof value !== "object") return false;
  if (!value.profile || typeof value.profile !== "object") return false;
  if (!Array.isArray(value.sessions)) return false;
  if (!Array.isArray(value.clubShots)) return false;
  if (!Array.isArray(value.healthEntries)) return false;
  return true;
}

function normalizeClub(value) {
  const raw = String(value || "").trim();
  if (validClubs.has(raw)) return raw;

  const clubMap = {
    driver: "Driver",
    hybrid: "Hybrid",
    iron: "7I",
    putter: "PW",
    wedge: "PW",
    wood: "Wood",
  };
  return clubMap[raw.toLowerCase()] || "";
}

function normalizeViewAngle(value) {
  const raw = String(value || "").trim();
  if (validViewAngles.has(raw)) return raw;

  const viewMap = {
    front: "face-on",
    rear: "down-the-line",
    side: "down-the-line",
    unknown: "down-the-line",
  };
  return viewMap[raw.toLowerCase()] || "";
}

function normalizeAnalysisInput(body) {
  if (!body || typeof body !== "object") return null;

  const videoName = String(body.videoName || "").trim();
  const club = normalizeClub(body.club || body.clubType || "Driver");
  const viewAngle = normalizeViewAngle(body.viewAngle || "down-the-line");
  const dominantHand = String(body.dominantHand || "right");
  const videoSizeBytes = Number(body.videoSizeBytes || 0);

  if (!videoName || !validClubs.has(club) || !validViewAngles.has(viewAngle) || !validDominantHands.has(dominantHand)) {
    return null;
  }

  return {
    videoName,
    videoSizeBytes: Number.isFinite(videoSizeBytes) && videoSizeBytes >= 0 ? videoSizeBytes : 0,
    club,
    viewAngle,
    dominantHand,
  };
}

function normalizeUploadedAnalysisInput(fields, file) {
  const body = {
    club: fields.club || fields.clubType,
    dominantHand: fields.dominantHand,
    videoName: fields.videoName || file?.fileName,
    videoSizeBytes: file?.data?.length || 0,
    viewAngle: fields.viewAngle,
  };
  return normalizeAnalysisInput(body);
}

function maybeMirrorPoint(point, dominantHand) {
  if (dominantHand !== "left") return point;
  return {
    x: Number((100 - point.x).toFixed(1)),
    y: point.y,
  };
}

function swingPoint(name, x, y, dominantHand) {
  const point = maybeMirrorPoint({ x, y }, dominantHand);
  return {
    name,
    x: point.x,
    y: point.y,
    score: 0.91,
  };
}

function clubPoint(x, y, dominantHand) {
  return maybeMirrorPoint({ x, y }, dominantHand);
}

function createPoseFrame(frame, timeSec, dominantHand, keypoints, club) {
  return {
    frame,
    timeSec,
    keypoints: keypoints.map(([name, x, y]) => swingPoint(name, x, y, dominantHand)),
    club: {
      grip: clubPoint(club.grip[0], club.grip[1], dominantHand),
      head: clubPoint(club.head[0], club.head[1], dominantHand),
      score: 0.88,
    },
  };
}

function mockPoseFrames(dominantHand) {
  const baseLower = [
    ["left_hip", 43, 61],
    ["right_hip", 61, 61],
    ["left_knee", 41, 80],
    ["right_knee", 64, 80],
    ["left_ankle", 38, 94],
    ["right_ankle", 67, 94],
  ];

  return [
    createPoseFrame(
      0,
      0,
      dominantHand,
      [
        ["head", 52, 23],
        ["neck", 52, 34],
        ["left_shoulder", 42, 38],
        ["right_shoulder", 62, 38],
        ["left_elbow", 45, 52],
        ["right_elbow", 59, 52],
        ["left_wrist", 49, 65],
        ["right_wrist", 56, 65],
        ...baseLower,
      ],
      { grip: [53, 66], head: [69, 76] },
    ),
    createPoseFrame(
      30,
      0.5,
      dominantHand,
      [
        ["head", 51, 22],
        ["neck", 51, 34],
        ["left_shoulder", 40, 39],
        ["right_shoulder", 61, 37],
        ["left_elbow", 38, 48],
        ["right_elbow", 55, 48],
        ["left_wrist", 39, 52],
        ["right_wrist", 49, 50],
        ...baseLower,
      ],
      { grip: [44, 51], head: [26, 35] },
    ),
    createPoseFrame(
      65,
      1.08,
      dominantHand,
      [
        ["head", 50, 22],
        ["neck", 51, 34],
        ["left_shoulder", 39, 40],
        ["right_shoulder", 60, 36],
        ["left_elbow", 33, 31],
        ["right_elbow", 44, 28],
        ["left_wrist", 34, 21],
        ["right_wrist", 42, 21],
        ...baseLower,
      ],
      { grip: [38, 21], head: [23, 12] },
    ),
    createPoseFrame(
      92,
      1.53,
      dominantHand,
      [
        ["head", 51, 23],
        ["neck", 52, 34],
        ["left_shoulder", 41, 38],
        ["right_shoulder", 62, 38],
        ["left_elbow", 44, 45],
        ["right_elbow", 55, 45],
        ["left_wrist", 50, 54],
        ["right_wrist", 57, 54],
        ...baseLower,
      ],
      { grip: [54, 54], head: [74, 42] },
    ),
    createPoseFrame(
      118,
      1.97,
      dominantHand,
      [
        ["head", 52, 23],
        ["neck", 52, 34],
        ["left_shoulder", 41, 38],
        ["right_shoulder", 63, 38],
        ["left_elbow", 46, 51],
        ["right_elbow", 58, 51],
        ["left_wrist", 52, 65],
        ["right_wrist", 59, 65],
        ...baseLower,
      ],
      { grip: [56, 66], head: [73, 78] },
    ),
    createPoseFrame(
      145,
      2.42,
      dominantHand,
      [
        ["head", 54, 22],
        ["neck", 54, 34],
        ["left_shoulder", 45, 37],
        ["right_shoulder", 65, 41],
        ["left_elbow", 59, 36],
        ["right_elbow", 70, 43],
        ["left_wrist", 70, 27],
        ["right_wrist", 76, 33],
        ...baseLower,
      ],
      { grip: [73, 30], head: [84, 16] },
    ),
  ];
}

function createMockAnalysis(user, input) {
  const id = createId("analysis");
  const headSway = input.viewAngle === "face-on" ? 6.2 : 4.8;
  const xFactor = input.club === "Driver" ? 31 : 27;
  const overall = Math.max(72, Math.min(91, 88 - Math.round(headSway) + Math.round(xFactor / 10)));

  return {
    id,
    createdAt: new Date().toISOString(),
    status: "completed",
    input: {
      videoName: input.videoName,
      club: input.club,
      viewAngle: input.viewAngle,
      dominantHand: input.dominantHand,
    },
    video: {
      durationSec: 3.2,
      fps: 60,
      width: 1920,
      height: 1080,
    },
    phases: [
      { name: "address", startFrame: 0, endFrame: 18, timeSec: 0 },
      { name: "takeaway", startFrame: 19, endFrame: 48, timeSec: 0.32 },
      { name: "backswing_top", startFrame: 49, endFrame: 78, timeSec: 0.82 },
      { name: "downswing", startFrame: 79, endFrame: 112, timeSec: 1.32 },
      { name: "impact", startFrame: 113, endFrame: 123, timeSec: 1.88 },
      { name: "follow_through", startFrame: 124, endFrame: 158, timeSec: 2.07 },
      { name: "finish", startFrame: 159, endFrame: 192, timeSec: 2.65 },
    ],
    pose2dFrames: mockPoseFrames(input.dominantHand),
    features: {
      tempoRatio: 3.1,
      shoulderTurnDeg: input.club === "Driver" ? 91 : 84,
      hipTurnDeg: input.club === "Driver" ? 45 : 39,
      xFactorDeg: xFactor,
      headSwayCm: headSway,
      pelvisSwayCm: 3.4,
      spineAngleDeg: 34,
      clubPath: input.club === "Driver" ? "in-to-out" : "neutral",
    },
    scores: {
      overall,
      setup: 86,
      backswing: 82,
      impact: 78,
      balance: 84,
    },
    recommendations: [
      {
        id: "rec-head-stability",
        phase: "backswing_top",
        severity: headSway > 6 ? "warning" : "info",
        title: "백스윙 상단에서 머리 이동을 줄이세요",
        detail: `${user.name}님의 현재 샘플 기준 머리 이동은 ${headSway.toFixed(1)}cm입니다. 중심축이 흔들리면 임팩트 재현성이 낮아질 수 있습니다.`,
        drill: "어드레스 때 만든 척추 각도를 유지한 채 오른발 안쪽 압력을 느끼며 하프스윙 10회를 반복하세요.",
        metric: "head_sway",
        value: `${headSway.toFixed(1)}cm`,
      },
      {
        id: "rec-x-factor",
        phase: "downswing",
        severity: "info",
        title: "전환 구간의 상하체 분리 타이밍을 유지하세요",
        detail: `어깨-골반 분리각은 ${xFactor}도로 양호한 편입니다. 다운스윙 시작 때 손보다 골반 회전이 먼저 열리는 흐름을 유지하는 것이 좋습니다.`,
        drill: "탑에서 1초 멈춘 뒤 왼쪽 골반을 먼저 여는 펌프 드릴을 5회씩 진행하세요.",
        metric: "x_factor",
        value: `${xFactor}deg`,
      },
      {
        id: "rec-impact-path",
        phase: "impact",
        severity: "info",
        title: "임팩트 구간 손-클럽 관계를 고정하세요",
        detail: "클럽 패스는 목표선 안쪽에서 접근하는 형태로 추정됩니다. 과도하게 손목을 풀면 페이스 관리가 어려워집니다.",
        drill: "임팩트 백 드릴로 손이 공보다 약간 앞선 위치를 유지한 채 짧은 피치샷을 반복하세요.",
        metric: "club_path",
        value: input.club === "Driver" ? "in-to-out" : "neutral",
      },
    ],
  };
}

function analysisListForUser(store, userId) {
  const analyses = store.swingAnalysesByUser?.[userId];
  return Array.isArray(analyses) ? analyses : [];
}

function analysisJobListForUser(store, userId) {
  const jobs = store.analysisJobsByUser?.[userId];
  return Array.isArray(jobs) ? jobs : [];
}

function findAnalysis(store, userId, analysisId) {
  return analysisListForUser(store, userId).find((analysis) => analysis.id === analysisId) || null;
}

function findAnalysisJob(store, userId, analysisId) {
  return analysisJobListForUser(store, userId).find((job) => job.analysisId === analysisId) || null;
}

function hasStoredVideo(job) {
  return Boolean(job?.videoPath && existsSync(job.videoPath));
}

function analysisSummary(analysis, jobs) {
  const job = jobs.find((item) => item.analysisId === analysis.id);
  return {
    createdAt: analysis.createdAt,
    hasVideo: hasStoredVideo(job),
    id: analysis.id,
    input: analysis.input,
    phaseCount: analysis.phases.length,
    recommendationCount: analysis.recommendations.length,
    scores: analysis.scores,
    status: analysis.status,
    updatedAt: job?.updatedAt || analysis.updatedAt || analysis.createdAt,
    video: analysis.video,
  };
}

function jobSummary(job) {
  return {
    createdAt: job.createdAt,
    hasVideo: hasStoredVideo(job),
    id: job.analysisId,
    input: job.input,
    phaseCount: 0,
    recommendationCount: 0,
    scores: null,
    status: job.status,
    updatedAt: job.updatedAt || job.createdAt,
    video: null,
  };
}

function findNearestPoseFrame(analysis, frame) {
  return analysis.pose2dFrames.reduce((best, current) => {
    if (!best) return current;
    return Math.abs(current.frame - frame) < Math.abs(best.frame - frame) ? current : best;
  }, null);
}

function maxAnalysisFrame(analysis) {
  const phaseMax = analysis.phases.reduce((best, phase) => Math.max(best, phase.endFrame), 0);
  const poseMax = analysis.pose2dFrames.reduce((best, poseFrame) => Math.max(best, poseFrame.frame), 0);
  return Math.max(1, phaseMax, poseMax, Math.round(analysis.video.durationSec * analysis.video.fps));
}

function normalizeAnalysisPhases(analysis, phases) {
  if (!Array.isArray(phases) || phases.length !== swingPhaseOrder.length) return null;
  const maxFrame = maxAnalysisFrame(analysis);
  const normalized = [];

  for (let index = 0; index < swingPhaseOrder.length; index += 1) {
    const phase = phases[index];
    if (!phase || phase.name !== swingPhaseOrder[index]) return null;

    const startFrame = Math.round(Number(phase.startFrame));
    const endFrame = Math.round(Number(phase.endFrame));
    if (!Number.isFinite(startFrame) || !Number.isFinite(endFrame)) return null;
    if (startFrame < 0 || endFrame < startFrame || endFrame > maxFrame) return null;
    if (index === 0 && startFrame !== 0) return null;
    if (index > 0 && startFrame !== normalized[index - 1].endFrame + 1) return null;
    if (index === swingPhaseOrder.length - 1 && endFrame !== maxFrame) return null;

    normalized.push({
      name: phase.name,
      startFrame,
      endFrame,
      timeSec: Number((startFrame / Math.max(analysis.video.fps, 1)).toFixed(3)),
    });
  }

  return normalized;
}

function updateAnalysisForUser(store, userId, analysisId, updater) {
  const analyses = analysisListForUser(store, userId);
  const current = analyses.find((analysis) => analysis.id === analysisId);
  if (!current) return null;
  const updated = updater(current);
  return {
    analysis: updated,
    store: {
      ...store,
      swingAnalysesByUser: {
        ...store.swingAnalysesByUser,
        [userId]: analyses.map((analysis) => (analysis.id === analysisId ? updated : analysis)),
      },
    },
  };
}

function upsertAnalysisJob(store, userId, job) {
  const jobs = analysisJobListForUser(store, userId);
  return {
    ...store,
    analysisJobsByUser: {
      ...store.analysisJobsByUser,
      [userId]: [job, ...jobs.filter((item) => item.analysisId !== job.analysisId)].slice(0, 60),
    },
  };
}

function updateAnalysisJob(userId, analysisId, patch) {
  const store = readStore();
  const current = findAnalysisJob(store, userId, analysisId);
  if (!current) return;

  const nextJob = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeStore(upsertAnalysisJob(store, userId, nextJob));
}

function completeAnalysisJob(userId, analysisId, result) {
  const store = readStore();
  const current = findAnalysisJob(store, userId, analysisId);
  const analyses = analysisListForUser(store, userId);
  const nextJob = {
    ...(current || { analysisId }),
    currentStage: "completed",
    progress: 100,
    status: "completed",
    updatedAt: new Date().toISOString(),
  };
  writeStore({
    ...upsertAnalysisJob(store, userId, nextJob),
    swingAnalysesByUser: {
      ...store.swingAnalysesByUser,
      [userId]: [result, ...analyses.filter((analysis) => analysis.id !== analysisId)].slice(0, 30),
    },
  });
}

async function runUploadedAnalysisJob({ analysisId, input, paths, user }) {
  try {
    updateAnalysisJob(user.id, analysisId, {
      currentStage: "pose2d_estimation",
      progress: 25,
      status: "processing",
    });
    await runPoseWorker({
      club: input.club,
      dominantHand: input.dominantHand,
      outputPath: paths.workerOutputPath,
      rootDir,
      videoPath: paths.videoPath,
      viewAngle: input.viewAngle,
    });

    updateAnalysisJob(user.id, analysisId, {
      currentStage: "normalizing_result",
      progress: 82,
      status: "processing",
    });
    const raw = JSON.parse(readFileSync(paths.workerOutputPath, "utf8"));
    const result = normalizeWorkerResult({
      analysisId,
      createdAt: new Date().toISOString(),
      input,
      raw,
      user,
    });
    writeFileSync(paths.resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    completeAnalysisJob(user.id, analysisId, result);
  } catch (error) {
    updateAnalysisJob(user.id, analysisId, {
      currentStage: "failed",
      error: error instanceof Error ? error.message : "analysis_failed",
      progress: 100,
      status: "failed",
    });
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const store = readStore();
  const auth = authFromRequest(req, store);

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, dataFile });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    if (!auth.user) {
      sendJson(res, 200, { authenticated: false });
      return;
    }
    sendJson(res, 200, {
      authenticated: true,
      user: publicUser(auth.user),
      data: store.dataByUser[auth.user.id] || initialData(auth.user),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    let body;
    try {
      body = await readJson(req);
    } catch {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }

    const name = String(body.name || "").trim();
    const phone = normalizePhone(body.phone);
    if (name.length < 1 || phone.length < 7) {
      sendJson(res, 400, { error: "invalid_profile" });
      return;
    }

    if (auth.user) {
      sendJson(res, 409, { error: "device_already_registered", user: publicUser(auth.user) });
      return;
    }

    if (store.users.some((user) => user.phone === phone)) {
      sendJson(res, 409, { error: "phone_already_registered" });
      return;
    }

    const deviceId = auth.deviceId || createId("device");
    const deviceIdHash = hash(deviceId);
    const user = {
      id: createId("user"),
      name,
      phone,
      deviceIdHash,
      deviceIdHashes: [deviceIdHash],
      createdAt: new Date().toISOString(),
    };

    const nextStore = {
      ...store,
      users: [...store.users, user],
      dataByUser: {
        ...store.dataByUser,
        [user.id]: initialData(user),
      },
    };
    writeStore(nextStore);
    setDeviceCookie(res, deviceId, req);
    sendJson(res, 201, {
      authenticated: true,
      user: publicUser(user),
      data: nextStore.dataByUser[user.id],
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    let body;
    try {
      body = await readJson(req);
    } catch {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }

    const name = String(body.name || "").trim();
    const phone = normalizePhone(body.phone);
    if (name.length < 1 || phone.length < 7) {
      sendJson(res, 400, { error: "invalid_profile" });
      return;
    }

    const targetUser = store.users.find((user) => userMatchesLogin(user, name, phone));
    if (!targetUser) {
      sendJson(res, 401, { error: "invalid_login" });
      return;
    }

    if (auth.user && auth.user.id !== targetUser.id) {
      sendJson(res, 409, { error: "device_already_registered", user: publicUser(auth.user) });
      return;
    }

    const deviceId = auth.deviceId || createId("device");
    const deviceIdHash = hash(deviceId);
    const deviceOwner = store.users.find((user) => user.id !== targetUser.id && userDeviceHashes(user).includes(deviceIdHash));
    if (deviceOwner) {
      sendJson(res, 409, { error: "device_already_registered", user: publicUser(deviceOwner) });
      return;
    }

    const updatedUser = attachDeviceToUser(targetUser, deviceIdHash);
    const nextStore = {
      ...store,
      users: store.users.map((user) => (user.id === targetUser.id ? updatedUser : user)),
      dataByUser: {
        ...store.dataByUser,
        [targetUser.id]: store.dataByUser[targetUser.id] || initialData(updatedUser),
      },
    };
    writeStore(nextStore);
    setDeviceCookie(res, deviceId, req);
    sendJson(res, 200, {
      authenticated: true,
      user: publicUser(updatedUser),
      data: nextStore.dataByUser[targetUser.id],
    });
    return;
  }

  if (!auth.user) {
    sendJson(res, 401, { error: "not_authenticated" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/analysis") {
    const analyses = analysisListForUser(store, auth.user.id);
    const jobs = analysisJobListForUser(store, auth.user.id);
    const completedIds = new Set(analyses.map((analysis) => analysis.id));
    const summaries = [
      ...jobs.filter((job) => !completedIds.has(job.analysisId)).map(jobSummary),
      ...analyses.map((analysis) => analysisSummary(analysis, jobs)),
    ];

    sendJson(res, 200, {
      analyses: summaries
        .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
        .slice(0, 30),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/analysis") {
    if (isMultipartRequest(req)) {
      let multipart;
      try {
        const buffer = await readBodyBuffer(req);
        multipart = parseMultipart(req, buffer);
      } catch {
        sendJson(res, 400, { error: "invalid_multipart" });
        return;
      }

      const videoFile = multipart?.files?.video;
      const input = normalizeUploadedAnalysisInput(multipart?.fields || {}, videoFile);
      if (!input || !videoFile || videoFile.data.length === 0) {
        sendJson(res, 400, { error: "invalid_analysis_upload" });
        return;
      }

      const analysisId = createId("analysis");
      const paths = analysisPaths(dataFile, analysisId, videoFile.fileName, videoFile.contentType);
      try {
        writeFileSync(paths.videoPath, videoFile.data);
      } catch {
        sendJson(res, 500, { error: "video_save_failed" });
        return;
      }

      const now = new Date().toISOString();
      const job = {
        analysisId,
        contentType: videoFile.contentType,
        createdAt: now,
        currentStage: "queued",
        error: null,
        input: {
          club: input.club,
          dominantHand: input.dominantHand,
          videoName: input.videoName,
          viewAngle: input.viewAngle,
        },
        progress: 0,
        resultPath: paths.resultPath,
        status: "queued",
        updatedAt: now,
        videoPath: paths.videoPath,
      };
      writeStore(upsertAnalysisJob(store, auth.user.id, job));
      void runUploadedAnalysisJob({ analysisId, input, paths, user: auth.user });
      sendJson(res, 202, {
        analysisId,
        currentStage: job.currentStage,
        progress: job.progress,
        status: job.status,
      });
      return;
    }

    let body;
    try {
      body = await readJson(req);
    } catch {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }

    const input = normalizeAnalysisInput(body);
    if (!input) {
      sendJson(res, 400, { error: "invalid_analysis_input" });
      return;
    }

    const analysis = createMockAnalysis(auth.user, input);
    const userAnalyses = analysisListForUser(store, auth.user.id);
    const nextStore = {
      ...store,
      swingAnalysesByUser: {
        ...store.swingAnalysesByUser,
        [auth.user.id]: [analysis, ...userAnalyses].slice(0, 30),
      },
    };
    writeStore(nextStore);
    sendJson(res, 201, {
      analysisId: analysis.id,
      status: analysis.status,
      result: analysis,
    });
    return;
  }

  const analysisPhasesMatch = url.pathname.match(/^\/api\/analysis\/([^/]+)\/phases$/);
  if (req.method === "PATCH" && analysisPhasesMatch) {
    const analysisId = decodeURIComponent(analysisPhasesMatch[1]);
    const analysis = findAnalysis(store, auth.user.id, analysisId);
    if (!analysis) {
      sendJson(res, 404, { error: "analysis_not_found" });
      return;
    }

    let body;
    try {
      body = await readJson(req);
    } catch {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }

    const phases = normalizeAnalysisPhases(analysis, body?.phases);
    if (!phases) {
      sendJson(res, 400, { error: "invalid_analysis_phases" });
      return;
    }

    const now = new Date().toISOString();
    const updated = updateAnalysisForUser(store, auth.user.id, analysisId, (current) => ({
      ...current,
      phases,
      updatedAt: now,
    }));
    if (!updated) {
      sendJson(res, 404, { error: "analysis_not_found" });
      return;
    }

    const job = findAnalysisJob(store, auth.user.id, analysisId);
    const nextStore = job ? upsertAnalysisJob(updated.store, auth.user.id, { ...job, updatedAt: now }) : updated.store;
    if (job?.resultPath) {
      try {
        writeFileSync(job.resultPath, `${JSON.stringify(updated.analysis, null, 2)}\n`, "utf8");
      } catch {
        sendJson(res, 500, { error: "analysis_result_save_failed" });
        return;
      }
    }

    writeStore(nextStore);
    sendJson(res, 200, { result: updated.analysis });
    return;
  }

  const analysisVideoMatch = url.pathname.match(/^\/api\/analysis\/([^/]+)\/video$/);
  if (req.method === "GET" && analysisVideoMatch) {
    const analysisId = decodeURIComponent(analysisVideoMatch[1]);
    const analysis = findAnalysis(store, auth.user.id, analysisId);
    const job = findAnalysisJob(store, auth.user.id, analysisId);
    if (!analysis || !hasStoredVideo(job)) {
      sendJson(res, 404, { error: "analysis_video_not_found" });
      return;
    }

    sendVideoFile(req, res, job.videoPath);
    return;
  }

  const analysisFrameMatch = url.pathname.match(/^\/api\/analysis\/([^/]+)\/frames\/(\d+)$/);
  if (req.method === "GET" && analysisFrameMatch) {
    const analysisId = decodeURIComponent(analysisFrameMatch[1]);
    const frameNumber = Number(analysisFrameMatch[2]);
    const analysis = findAnalysis(store, auth.user.id, analysisId);
    if (!analysis) {
      sendJson(res, 404, { error: "analysis_not_found" });
      return;
    }

    const frame = findNearestPoseFrame(analysis, frameNumber);
    if (!frame) {
      sendJson(res, 404, { error: "frame_not_found" });
      return;
    }
    sendJson(res, 200, { frame });
    return;
  }

  const analysisMatch = url.pathname.match(/^\/api\/analysis\/([^/]+)(?:\/(status))?$/);
  if (req.method === "GET" && analysisMatch) {
    const analysisId = decodeURIComponent(analysisMatch[1]);
    const analysis = findAnalysis(store, auth.user.id, analysisId);
    const job = findAnalysisJob(store, auth.user.id, analysisId);

    if (analysisMatch[2] === "status") {
      if (job) {
        sendJson(res, 200, {
          analysisId,
          currentStage: job.currentStage || "",
          error: job.error || null,
          progress: typeof job.progress === "number" ? job.progress : analysis ? 100 : 0,
          status: job.status || analysis?.status || "completed",
        });
        return;
      }
      if (analysis) {
        sendJson(res, 200, { analysisId: analysis.id, currentStage: "completed", error: null, progress: 100, status: analysis.status });
        return;
      }
      sendJson(res, 404, { error: "analysis_not_found" });
      return;
    }

    if (!analysis) {
      if (job) {
        sendJson(res, 202, {
          analysisId,
          currentStage: job.currentStage || "",
          error: job.error || null,
          progress: typeof job.progress === "number" ? job.progress : 0,
          status: job.status,
        });
        return;
      }
      sendJson(res, 404, { error: "analysis_not_found" });
      return;
    }

    sendJson(res, 200, { result: analysis });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/data") {
    sendJson(res, 200, { data: store.dataByUser[auth.user.id] || initialData(auth.user) });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/data") {
    let body;
    try {
      body = await readJson(req);
    } catch {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }

    if (!validateAppData(body.data)) {
      sendJson(res, 400, { error: "invalid_data" });
      return;
    }

    const nextData = {
      ...body.data,
      profile: {
        ...body.data.profile,
        id: auth.user.id,
        phone: auth.user.phone,
      },
    };
    writeStore({
      ...store,
      dataByUser: {
        ...store.dataByUser,
        [auth.user.id]: nextData,
      },
    });
    sendJson(res, 200, { data: nextData });
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/api/")) {
    handleApi(req, res).catch((error) => {
      console.error(error);
      sendJson(res, 500, { error: "server_error" });
    });
    return;
  }

  sendJson(res, 404, { error: "api_only" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`GolfLog API listening on http://127.0.0.1:${port}`);
  console.log(`Data file: ${dataFile}`);
});
