# Phase 0 Setup

This is the initial environment and dependency snapshot for the app foundation. It is kept for setup history; the current Swing AI progress and next work items are tracked in `docs/SWING_AI_PROGRESS_PLAN.md`.

## Local Environment

- Machine target: MacBook Air M4 / Apple Silicon.
- CPU architecture detected: `arm64`.
- Node detected: `v25.9.0`.
- npm detected: `11.12.1`.
- Package manager for this project: npm.

This setup avoids native build-heavy packages at the start, so it should work cleanly on Apple Silicon without Rosetta.

## Install Now

Runtime libraries:

- `react`: app UI foundation.
- `react-dom`: browser rendering.
- `react-router-dom`: six-section navigation.
- `zod`: typed validation for session, shot, and health data.
- `lucide-react`: icon set for buttons and navigation.
- `clsx`: small utility for conditional class names.
- `@fontsource/ibm-plex-sans-kr`: Korean UI font.
- `@fontsource/ibm-plex-sans`: Latin UI fallback.
- `@fontsource/ibm-plex-mono`: numeric and compact metric labels.
- `@fontsource/bebas-neue`: display number style from the wireframes.
- `@fontsource/caveat`: handwritten note style from the wireframes.

Development libraries:

- `vite`: local dev server and production build.
- `typescript`: type checking.
- `@vitejs/plugin-react`: React support for Vite.
- `@types/react`: React TypeScript types.
- `@types/react-dom`: React DOM TypeScript types.

## Defer Until Needed

- `react-hook-form`: add when Today Log and Health forms become editable.
- `date-fns`: add when calendar/date calculations become more complex.
- `zustand`: add only if cross-page state grows beyond local React state.
- `vitest`, `@testing-library/react`: add when behavior becomes test-worthy.
- `playwright`: add when responsive and browser QA starts.

The current app still uses local React state and custom validation rather than these deferred libraries.

## Chart Decision

Do not install a chart library in Phase 0. The design already uses custom SVG charts, and keeping them custom makes the fairway, heatmap, and radar views easier to match exactly.
