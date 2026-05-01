import { mkdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";

const allowedVideoExtensions = new Set([".mp4", ".mov", ".m4v", ".webm"]);

export function analysisStorageRoot(dataFile) {
  return process.env.GOLFLOG_DATA_DIR || dirname(dataFile);
}

export function safeVideoExtension(fileName, contentType = "") {
  const extension = extname(String(fileName || "").toLowerCase());
  if (allowedVideoExtensions.has(extension)) return extension;
  if (contentType.includes("quicktime")) return ".mov";
  if (contentType.includes("webm")) return ".webm";
  return ".mp4";
}

export function analysisPaths(dataFile, analysisId, fileName = "", contentType = "") {
  const root = analysisStorageRoot(dataFile);
  const videosDir = join(root, "videos");
  const analysisDir = join(root, "analysis");
  mkdirSync(videosDir, { recursive: true });
  mkdirSync(analysisDir, { recursive: true });

  const videoExtension = safeVideoExtension(fileName, contentType);
  return {
    analysisDir,
    resultPath: join(analysisDir, `${analysisId}.json`),
    root,
    videoPath: join(videosDir, `${analysisId}${videoExtension}`),
    videosDir,
    workerOutputPath: join(analysisDir, `${analysisId}.worker.json`),
  };
}
