# GolfLog

GolfLog is a personal localhost golf tracking web app built with React, TypeScript, Vite, and a local Node API.

It supports screen golf shot entry, club distance tracking, health records, a Japan holiday calendar, bilingual Korean/English UI, and managed per-device profiles.

## Data Storage

User-entered records are stored by the local Node API in the configured server data file. Users log in or register with their name and phone number, and the browser only keeps the httpOnly device cookie used to identify the registered device.

## Development

```bash
npm install
npm run dev:api
npm run dev
```

Vite proxies `/api` requests to the API process on port `3001`.

## Build

```bash
npm run build
```

## Local Personal Use

See `docs/LOCAL_PERSONAL_USE.md`. The short version is:

```bash
GOLFLOG_DATA_FILE=/Volumes/X31/golflog-data/golflog.json npm run start:api
npm run dev
```

The app is served only on localhost: `http://127.0.0.1:5173/`. Vite proxies `/api/` to `http://127.0.0.1:3001/api/`.
