#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${GOLFLOG_POSE_BOOTSTRAP_PYTHON:-}"
POSE_VENV="${GOLFLOG_POSE_VENV:-$ROOT_DIR/.venv-pose}"

if [[ -z "$PYTHON_BIN" ]]; then
  for candidate in python3.11 /opt/homebrew/bin/python3.11 python3.12 /opt/homebrew/bin/python3.12 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      PYTHON_BIN="$(command -v "$candidate")"
      break
    fi
  done
fi

if [[ -z "$PYTHON_BIN" ]]; then
  printf 'No Python executable found. Install Python 3.11 first, then rerun npm run setup:pose.\n' >&2
  exit 1
fi

PYTHON_VERSION="$("$PYTHON_BIN" -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')"
PYTHON_MAJOR_MINOR="$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"

printf 'Using Python %s at %s\n' "$PYTHON_VERSION" "$PYTHON_BIN"
if [[ "$PYTHON_MAJOR_MINOR" != "3.11" ]]; then
  printf 'Warning: Python 3.11 is preferred for legacy MediaPipe mp.solutions. Continuing with %s.\n' "$PYTHON_MAJOR_MINOR" >&2
fi

"$PYTHON_BIN" -m venv "$POSE_VENV"
"$POSE_VENV/bin/python" -m pip install --upgrade pip
"$POSE_VENV/bin/python" -m pip install -r "$ROOT_DIR/workers/pose/requirements.txt"

printf '\nPose runtime created at %s\n' "$POSE_VENV"
printf 'Run npm run check:pose to verify the worker against a local sample video.\n'
