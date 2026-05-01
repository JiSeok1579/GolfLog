# Pose Worker

Phase 1 local worker for GolfLog swing analysis.

Run directly:

```bash
python3 workers/pose/analyze_pose.py \
  --video /path/to/swing.mp4 \
  --out /tmp/golflog-worker.json \
  --model mediapipe \
  --runtime auto \
  --view-angle down-the-line \
  --club-type Driver \
  --dominant-hand right
```

Install optional baseline dependencies:

```bash
npm run setup:pose
```

The setup script creates `.venv-pose` with Python 3.11 when available and pins the working macOS arm64 baseline: `mediapipe==0.10.21`, `opencv-contrib-python==4.11.0.86`, and `numpy==1.26.4`. The Node API worker automatically prefers `.venv-pose/bin/python` when it exists, then falls back to `.venv/bin/python`, then `python3`.

Verify a local sample video:

```bash
npm run check:pose
npm run check:pose -- --require-real /path/to/swing.mp4
```

The first command verifies that the worker produces usable analysis JSON. The `--require-real` form fails if the worker is still using fallback frames.

Render a local overlay preview contact sheet:

```bash
npm run preview:pose
npm run preview:pose -- --require-real /path/to/swing.mp4 /tmp/golflog-pose-preview.jpg
```

The preview command writes worker JSON and the rendered image to `/tmp` by default. Keep those outputs local; do not commit sample videos, generated previews, or model files.

For MediaPipe Tasks, keep the model outside Git:

```bash
mkdir -p /Volumes/X31/golflog-data/models
curl -L https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task \
  -o /Volumes/X31/golflog-data/models/pose_landmarker_full.task
```

Then run with an explicit model path or `GOLFLOG_POSE_RUNTIME=tasks`:

```bash
GOLFLOG_POSE_RUNTIME=tasks \
GOLFLOG_POSE_LANDMARKER_MODEL=/Volumes/X31/golflog-data/models/pose_landmarker_full.task \
python3 workers/pose/analyze_pose.py \
  --video /path/to/swing.mp4 \
  --out /tmp/golflog-worker.json
```

The worker runs MediaPipe in an isolated child process. If a native MediaPipe crash occurs, the parent process writes fallback pose frames instead of failing the whole API job. On the current Python 3.13 MediaPipe wheel, `mp.solutions` is not exposed; use `npm run setup:pose` so the worker runs through the Python 3.11 `.venv-pose` runtime. In restricted or non-GUI shells, macOS native graphics access can be blocked and MediaPipe may fall back even when the same command succeeds in the normal local environment.

Useful runtime controls:

```bash
GOLFLOG_POSE_RUNTIME=auto       # default: use mp.solutions when available; otherwise fallback
GOLFLOG_POSE_RUNTIME=tasks      # opt into MediaPipe Tasks with the local .task model
GOLFLOG_POSE_RUNTIME=fallback   # skip MediaPipe and force deterministic fallback frames
GOLFLOG_POSE_MAX_FRAMES=140     # cap sampled pose frames
```

If `opencv-python` or `mediapipe` is unavailable, the worker writes fallback pose frames so the Node upload, job, normalization, and overlay pipeline can still be tested locally. The fallback is not a swing analysis model.

Before committing pose work, run:

```bash
npm run check:payload
```
