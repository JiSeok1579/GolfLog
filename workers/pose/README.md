# Pose Worker

Phase 1 local worker for GolfLog swing analysis.

Run directly:

```bash
python3 workers/pose/analyze_pose.py \
  --video /path/to/swing.mp4 \
  --out /tmp/golflog-worker.json \
  --model mediapipe \
  --view-angle down-the-line \
  --club-type Driver \
  --dominant-hand right
```

Install optional baseline dependencies:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r workers/pose/requirements.txt
```

The Node API worker automatically prefers `.venv/bin/python` when it exists.

For MediaPipe Tasks, keep the model outside Git:

```bash
mkdir -p /Volumes/X31/golflog-data/models
curl -L https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task \
  -o /Volumes/X31/golflog-data/models/pose_landmarker_full.task
```

Then run with an explicit model path or `GOLFLOG_POSE_ENABLE_TASKS=1`. On the current Python 3.13 MediaPipe wheel, `mp.solutions` is not exposed; without an explicitly enabled Tasks runtime the worker uses fallback frames so the upload, job, normalization, and overlay pipeline remains usable.

If `opencv-python` or `mediapipe` is unavailable, the worker writes fallback pose frames so the Node upload, job, normalization, and overlay pipeline can still be tested locally. The fallback is not a swing analysis model.

Before committing pose work, run:

```bash
npm run check:payload
```
