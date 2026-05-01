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

The Node API worker automatically prefers `.venv-pose/bin/python` when it exists, then falls back to `.venv/bin/python`, then `python3`.

Verify a local sample video:

```bash
npm run check:pose
npm run check:pose -- --require-real /path/to/swing.mp4
```

The first command verifies that the worker produces usable analysis JSON. The `--require-real` form fails if the worker is still using fallback frames.

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

The worker runs MediaPipe in an isolated child process. If a native MediaPipe crash occurs, the parent process writes fallback pose frames instead of failing the whole API job. On the current Python 3.13 MediaPipe wheel, `mp.solutions` is not exposed; without an explicitly enabled Tasks runtime the worker uses fallback frames so the upload, job, normalization, and overlay pipeline remains usable.

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
