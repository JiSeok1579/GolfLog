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
python3 -m pip install -r workers/pose/requirements.txt
```

If `opencv-python` or `mediapipe` is unavailable, the worker writes fallback pose frames so the Node upload, job, normalization, and overlay pipeline can still be tested locally. The fallback is not a swing analysis model.
