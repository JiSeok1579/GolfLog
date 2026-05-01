import { spawn } from "node:child_process";
import { resolve } from "node:path";

export function runPoseWorker({ club, dominantHand, model = "mediapipe", outputPath, rootDir, timeoutMs = 180000, videoPath, viewAngle }) {
  const python = process.env.GOLFLOG_POSE_PYTHON || "python3";
  const scriptPath = resolve(rootDir, "workers", "pose", "analyze_pose.py");
  const args = [
    scriptPath,
    "--video",
    videoPath,
    "--out",
    outputPath,
    "--model",
    model,
    "--view-angle",
    viewAngle,
    "--club-type",
    club,
    "--dominant-hand",
    dominantHand,
  ];

  return new Promise((resolveWorker, reject) => {
    const child = spawn(python, args, {
      cwd: rootDir,
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
