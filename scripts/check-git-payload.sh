#!/usr/bin/env bash
set -euo pipefail

blocked=()

while IFS= read -r -d '' path; do
  case "$path" in
    .venv/*|.venv-pose/*|server-data/*|models/*|data/raw/*|data/external/*)
      blocked+=("$path")
      ;;
    *.task|*.tflite|*.onnx|*.pt|*.pth|*.ckpt|*.h5|*.pb|*.mlmodel)
      blocked+=("$path")
      ;;
    *.mp4|*.mov|*.m4v|*.webm|*.avi|*.mkv)
      blocked+=("$path")
      ;;
    *.sqlite|*.sqlite-shm|*.sqlite-wal|*.db|*.parquet|*.npy|*.npz|*.pkl)
      blocked+=("$path")
      ;;
    */._*|._*)
      blocked+=("$path")
      ;;
  esac
done < <(git ls-files -z)

if ((${#blocked[@]} > 0)); then
  printf 'Blocked local-only files are tracked by Git:\n' >&2
  printf ' - %s\n' "${blocked[@]}" >&2
  exit 1
fi

printf 'Repository payload check passed. No local-only model, media, or dataset files are tracked.\n'
