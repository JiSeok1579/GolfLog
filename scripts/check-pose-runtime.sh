#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRE_REAL=0

if [[ "${1:-}" == "--require-real" ]]; then
  REQUIRE_REAL=1
  shift
fi

VIDEO_PATH="${1:-${GOLFLOG_POSE_CHECK_VIDEO:-/tmp/golfdb-test-video.mp4}}"
OUT_PATH="${GOLFLOG_POSE_CHECK_OUT:-/tmp/golflog-pose-runtime-check.json}"
RUNTIME="${GOLFLOG_POSE_RUNTIME:-auto}"
MAX_FRAMES="${GOLFLOG_POSE_MAX_FRAMES:-48}"

if [[ ! -f "$VIDEO_PATH" ]]; then
  printf 'Sample video not found: %s\n' "$VIDEO_PATH" >&2
  printf 'Pass a local video path: npm run check:pose -- /path/to/swing.mp4\n' >&2
  exit 1
fi

if [[ -n "${GOLFLOG_POSE_PYTHON:-}" ]]; then
  PYTHON_BIN="$GOLFLOG_POSE_PYTHON"
elif [[ -x "$ROOT_DIR/.venv-pose/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/.venv-pose/bin/python"
elif [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
else
  PYTHON_BIN="python3"
fi

MPLCONFIGDIR="${MPLCONFIGDIR:-/tmp/mpl}" PYTHONDONTWRITEBYTECODE=1 "$PYTHON_BIN" "$ROOT_DIR/workers/pose/analyze_pose.py" \
  --video "$VIDEO_PATH" \
  --out "$OUT_PATH" \
  --model mediapipe \
  --runtime "$RUNTIME" \
  --view-angle down-the-line \
  --club-type Driver \
  --dominant-hand right \
  --max-frames "$MAX_FRAMES"

node -e '
const fs = require("node:fs");
const path = process.argv[1];
const requireReal = process.argv[2] === "1";
const data = JSON.parse(fs.readFileSync(path, "utf8"));
const summary = {
  model: data.model,
  runtime: data.debug?.runtime || "",
  frames: Array.isArray(data.frames) ? data.frames.length : 0,
  frameCount: data.debug?.frameCount || 0,
  clubDetectedFrames: data.debug?.clubDetectedFrames || 0,
  droppedFrames: data.debug?.droppedFrames || 0,
  fallbackReason: data.debug?.fallbackReason || null,
};
console.log(JSON.stringify(summary, null, 2));
if (requireReal && String(data.model || "").includes("fallback")) {
  console.error("Pose runtime is still using fallback frames.");
  process.exit(2);
}
' "$OUT_PATH" "$REQUIRE_REAL"
