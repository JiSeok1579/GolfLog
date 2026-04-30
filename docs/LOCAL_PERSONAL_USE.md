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
