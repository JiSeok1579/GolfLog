#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRE_REAL=0

if [[ "${1:-}" == "--require-real" ]]; then
  REQUIRE_REAL=1
  shift
fi

VIDEO_PATH="${1:-${GOLFLOG_POSE_PREVIEW_VIDEO:-/tmp/golfdb-test-video.mp4}}"
OUT_PATH="${2:-${GOLFLOG_POSE_PREVIEW_OUT:-/tmp/golflog-pose-preview.jpg}}"
ANALYSIS_PATH="${GOLFLOG_POSE_PREVIEW_ANALYSIS:-/tmp/golflog-pose-preview.json}"
RUNTIME="${GOLFLOG_POSE_RUNTIME:-auto}"
MAX_FRAMES="${GOLFLOG_POSE_MAX_FRAMES:-48}"
MAX_PANELS="${GOLFLOG_POSE_PREVIEW_PANELS:-12}"

if [[ ! -f "$VIDEO_PATH" ]]; then
  printf 'Sample video not found: %s\n' "$VIDEO_PATH" >&2
  printf 'Pass a local video path: npm run preview:pose -- /path/to/swing.mp4 /tmp/golflog-pose-preview.jpg\n' >&2
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
  --out "$ANALYSIS_PATH" \
  --model mediapipe \
  --runtime "$RUNTIME" \
  --view-angle down-the-line \
  --club-type Driver \
  --dominant-hand right \
  --max-frames "$MAX_FRAMES"

REQUIRE_REAL_ARG=()
if [[ "$REQUIRE_REAL" == "1" ]]; then
  REQUIRE_REAL_ARG=(--require-real)
fi

MPLCONFIGDIR="${MPLCONFIGDIR:-/tmp/mpl}" PYTHONDONTWRITEBYTECODE=1 "$PYTHON_BIN" "$ROOT_DIR/workers/pose/render_pose_preview.py" \
  --video "$VIDEO_PATH" \
  --analysis "$ANALYSIS_PATH" \
  --out "$OUT_PATH" \
  --max-panels "$MAX_PANELS" \
  "${REQUIRE_REAL_ARG[@]}"
