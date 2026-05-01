# GolfLog

GolfLog is a personal localhost golf tracking web app built with React, TypeScript, Vite, and a local Node API.

It supports screen golf shot entry, club distance tracking, health records, a Japan holiday calendar, bilingual Korean/English UI, managed per-device profiles, and a local Swing AI analysis workflow.

## Data Storage

User-entered records are stored by the local Node API in the configured server data file. Users log in or register with their name and phone number, and the browser only keeps the httpOnly device cookie used to identify the registered device.

## Copyright and Local Data

Model files, sample videos, user records, and dataset artifacts are local operating data and must not be committed. See `NOTICE.md` and `docs/COPYRIGHT_AND_DATA_POLICY.md`.

Swing AI uploads, generated analysis JSON, model files, and preview artifacts stay outside Git under the configured local data directory, usually `/Volumes/X31/golflog-data/`.

## Development

```bash
npm install
npm run check:payload
npm run dev:api
npm run dev
```

Vite proxies `/api` requests to the API process on port `3001`.

## Build

```bash
npm run build
```

## Swing AI Local Checks

```bash
npm run setup:pose
npm run check:pose -- --require-real /path/to/swing.mp4
npm run inspect:pose -- --require-real /path/to/swing.mp4 /tmp/golflog-pose-quality.md
```

The current baseline uses MediaPipe for body keypoints, a local OpenCV club detector, and an optional external club detector command. See `AI_POSE_MODEL_AGENT_GUIDE.md`, `workers/pose/README.md`, `docs/SWING_AI_PROGRESS_PLAN.md`, and `docs/CLUB_MODEL_ADAPTER.md`.

## Local Personal Use

See `docs/LOCAL_PERSONAL_USE.md`. The short version is:

```bash
GOLFLOG_DATA_FILE=/Volumes/X31/golflog-data/golflog.json npm run start:api
npm run dev
```

The app is served only on localhost: `http://127.0.0.1:5173/`. Vite proxies `/api/` to `http://127.0.0.1:3001/api/`.
