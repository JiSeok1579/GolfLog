# GolfLog local personal use

This setup is for personal use on this Mac only. It does not use nginx and does not expose the app to the lab network or the public internet.

## Access scope

Use only:

```text
http://127.0.0.1:5173/
```

Do not use:

- the Mac's LAN IP,
- router DNS,
- router port forwarding,
- DDNS or tunneling,
- nginx,
- public 80/443 listeners.

## 1. API

The API stores user records on the external drive:

```text
/Volumes/X31/golflog-data/golflog.json
```

Swing AI uploads and generated analysis files also stay under this local data directory. Model files stay in `/Volumes/X31/golflog-data/models/` and must not be committed.

The LaunchAgent starts the API on:

```text
http://127.0.0.1:3001
```

Manual API start:

```bash
GOLFLOG_DATA_FILE=/Volumes/X31/golflog-data/golflog.json npm run dev:api
```

## 2. App

Start the app with Vite:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

Vite proxies `/api` requests to `http://127.0.0.1:3001`.

## 3. Login

The app shows login and device registration.

Registration creates:

- one user record,
- one data bucket for that user,
- one httpOnly `golflog_device` cookie for this browser.

Login uses the same name and phone number and loads the saved records for that account.

This is a practical browser-device rule. Clearing browser data or using another browser can appear as a new device.

## 4. Swing AI

Open:

```text
http://127.0.0.1:5173/swing-ai
```

The current local baseline runs a Python pose worker from the Node API. It uses MediaPipe for body keypoints and a local club detector. Keep sample videos, generated previews, and model files outside Git.

Useful checks:

```bash
npm run check:pose -- --require-real /path/to/swing.mp4
npm run inspect:pose -- --require-real /path/to/swing.mp4 /tmp/golflog-pose-quality.md
npm run check:payload
```
