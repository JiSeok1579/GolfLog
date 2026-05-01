import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

function defaultPython(rootDir) {
  const poseVenvPython = resolve(rootDir, ".venv-pose", "bin", "python");
  if (existsSync(poseVenvPython)) return poseVenvPython;

  const venvPython = resolve(rootDir, ".venv", "bin", "python");
  return existsSync(venvPython) ? venvPython : "python3";
}

export function runPoseWorker({ club, dominantHand, model = "mediapipe", outputPath, rootDir, timeoutMs = 180000, videoPath, viewAngle }) {
  const python = process.env.GOLFLOG_POSE_PYTHON || defaultPython(rootDir);
  const scriptPath = resolve(rootDir, "workers", "pose", "analyze_pose.py");
  const runtime = process.env.GOLFLOG_POSE_RUNTIME || "auto";
  const args = [
    scriptPath,
    "--video",
    videoPath,
    "--out",
    outputPath,
    "--model",
    model,
    "--runtime",
    runtime,
    "--view-angle",
    viewAngle,
    "--club-type",
    club,
    "--dominant-hand",
    dominantHand,
  ];
  if (process.env.GOLFLOG_POSE_LANDMARKER_MODEL) {
    args.push("--landmarker-model", process.env.GOLFLOG_POSE_LANDMARKER_MODEL);
  }
  if (process.env.GOLFLOG_POSE_MAX_FRAMES) {
    args.push("--max-frames", process.env.GOLFLOG_POSE_MAX_FRAMES);
  }

  return new Promise((resolveWorker, reject) => {
    const child = spawn(python, args, {
      cwd: rootDir,
      env: {
        ...process.env,
        MPLCONFIGDIR: process.env.MPLCONFIGDIR || "/tmp/mpl",
        PYTHONDONTWRITEBYTECODE: process.env.PYTHONDONTWRITEBYTECODE || "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`pose_worker_timeout:${timeoutMs}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`pose_worker_failed:${code}:${stderr || stdout}`));
        return;
      }
      resolveWorker({ stderr, stdout });
    });
  });
}
