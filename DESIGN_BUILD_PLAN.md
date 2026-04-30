# Golf Log Design Build Plan

## 1. Current Folder Review

The current folder contains only design assets, not an application codebase.

- `design/Golf Log Wireframes.html`: React/Babel static prototype shell.
- `design/src/wireframe-styles.css`: shared visual system for all wireframes.
- `design/src/wireframe-parts.jsx`: shared UI atoms, charts, fake data, top navigation.
- `design/src/variant-lines.jsx`: Variant 1, time-series/trend-first screens.
- `design/src/variant-bars.jsx`: Variant 2, comparison-first screens.
- `design/src/variant-heatmap.jsx`: Variant 3, consistency/calendar-first screens.
- `design/src/variant-radar.jsx`: Variant 4, profile/radar-first screens.

The wireframes define four design directions across the same product domain. They should be treated as design alternatives and component references, not production-ready code.

## 2. Design Direction

Build the production app around the shared design language:

- Dark cinematic teal background and cards.
- Warm orange accent for primary actions, best markers, and emphasis only.
- Fairway green surfaces for golf-specific visualizations.
- Dense dashboard layout with compact cards, tables, charts, and segmented controls.
- Korean-first product copy, with English labels only where golf/screen-golf terms are clearer.
- Desktop-first artboard baseline of `1180 x 720`, then responsive collapse for tablet/mobile.

Recommended product composition:

- Use Variant 1 as the main navigation and dashboard foundation because it is the most complete for daily tracking.
- Use Variant 3 for calendar and consistency views.
- Use Variant 4 for screen-golf shot DNA and health balance views.
- Use Variant 2 only for comparison widgets where bars are easier to scan than lines.

## 3. MVP Screen Scope

### Dashboard

- Top navigation: dashboard, today log, distance, screen golf, health, calendar.
- Summary stats: driver best, monthly sessions, weight, BMI.
- Driver trend chart.
- Weight trend chart.
- Recent weekly records table.
- Primary actions: add health entry, add today log.

### Today Log

- Session basics: type, date, start time, duration, location.
- Condition scores: condition, focus, feel.
- Per-club best distance input.
- Optional screen-golf metrics per club.
- Notes field.
- Save and cancel actions.

### Distance

- Fairway visualization for best vs average shot.
- Club distance trend chart.
- Club chips for filtering.
- Personal best table.
- Comparison widgets for this month vs last month.

### Screen Golf

- Per-club metric input: ball speed, head speed, launch angle, spin, carry, total, side deviation.
- Recent-session comparison chart.
- Shot DNA radar for current session vs average.
- Save result action.

### Health

- Health summary: BMI, health score, sleep, blood pressure, resting heart rate.
- Weight trend chart.
- Blood pressure trend chart.
- Health radar against target zone.
- Daily health entry form.

### Calendar

- Monthly workout calendar.
- Heatmap intensity by session volume or workout duration.
- Day detail panel showing club records, session type, duration, and notes.
- Streak and active-day summaries.

## 4. Core Data Model

Use these entities as the first implementation contract.

```ts
type UserProfile = {
  id: string;
  name: string;
  heightCm: number;
  birthYear?: number;
  distanceUnit: "m" | "yd";
  weightUnit: "kg" | "lb";
};

type Session = {
  id: string;
  date: string;
  type: "range" | "screen" | "round" | "practice" | "lesson";
  startTime?: string;
  durationMinutes?: number;
  location?: string;
  ballsHit?: number;
  condition?: number;
  focus?: number;
  feel?: number;
  notes?: string;
};

type ClubShot = {
  id: string;
  sessionId: string;
  club: string;
  carryM?: number;
  totalM?: number;
  ballSpeed?: number;
  headSpeed?: number;
  launchAngle?: number;
  backspin?: number;
  sidespin?: number;
  sideDeviationM?: number;
};

type HealthEntry = {
  id: string;
  date: string;
  weightKg?: number;
  sleepHours?: number;
  systolic?: number;
  diastolic?: number;
  restingHr?: number;
};
```

Derived metrics:

- BMI from profile height and latest weight.
- Personal best by club.
- Monthly average by club.
- Streak and active days.
- Health score from BMI, sleep, blood pressure, adherence, and weight stability.
- Radar-normalized values from shot and health metrics.

## 5. Technical Plan

Recommended stack:

- React + TypeScript + Vite for the first version.
- CSS variables or Tailwind theme tokens for the existing color system.
- Local storage or SQLite-backed API for the first local build.
- Recharts, Visx, or custom SVG components for charts. The prototype already proves custom SVG is enough for line, bar, heatmap, radar, fairway, and ball-flight views.
- React Router for page navigation.
- Zod for form/data validation.

Suggested source structure:

```text
src/
  app/
    App.tsx
    routes.tsx
  components/
    layout/
    charts/
    forms/
    ui/
  features/
    dashboard/
    log/
    distance/
    screen-golf/
    health/
    calendar/
  data/
    schema.ts
    seed.ts
    storage.ts
  styles/
    tokens.css
    global.css
```

## 6. Implementation Phases

### Phase 1: App Foundation

- Initialize React + TypeScript project.
- Add route shell and top navigation.
- Port design tokens from `wireframe-styles.css`.
- Define reusable UI atoms: button, card, chip, segmented control, field, stat card, table.
- Fix missing prototype color tokens before porting:
  - `--w-fill-1`
  - `--w-fill-2`
  - `--w-fill-3`
  - `--w-fill-4`
  - `--w-teal-soft`

### Phase 2: Chart and Visualization Components

- Port chart components from `wireframe-parts.jsx` into typed React components.
- Implement line chart, bar chart, heatmap, radar chart, fairway, and ball-flight components.
- Replace prototype-only random values with deterministic seed data and real state.
- Add empty, loading, and no-data states.

### Phase 3: Data Layer

- Define TypeScript schemas for profile, sessions, club shots, and health entries.
- Add seed data matching the wireframes.
- Add local persistence.
- Add unit conversion for meters/yards and kilograms/pounds. Do not simply swap labels.

### Phase 4: MVP Screens

- Build Dashboard from Variant 1.
- Build Today Log from Variant 1, with bar/radar preview elements where useful.
- Build Distance from Variant 1 plus Variant 2 comparison widgets.
- Build Screen Golf from Variant 4.
- Build Health from Variant 1 and Variant 4.
- Build Calendar from Variant 3.

### Phase 5: Responsive and Interaction Polish

- Collapse top navigation into a compact/mobile menu.
- Convert wide grids into single-column mobile layouts.
- Add hover, focus, selected, disabled, validation, and save-success states.
- Ensure all buttons and form controls are keyboard reachable.
- Keep chart labels legible at mobile widths.

### Phase 6: QA

- Verify layout at desktop, tablet, and mobile widths.
- Check that text does not overflow buttons, cards, chips, or table cells.
- Validate all forms and unit conversions.
- Test seeded data, save/edit/delete flows, and derived metrics.
- Compare major screens against the original wireframes before final handoff.

## 7. Acceptance Criteria

- The app opens directly into the usable dashboard, not a marketing page.
- All six primary sections are reachable from navigation.
- A user can create a session, enter club distances, and see dashboard/distance/calendar updates.
- A user can enter health data and see BMI/health charts update.
- Screen-golf metrics can be entered and displayed as a shot DNA radar.
- The visual language matches the design: dark teal surfaces, orange emphasis, compact data cards, golf-specific fairway/heatmap/radar visuals.
- Desktop and mobile layouts remain readable without overlapping UI.

## 8. Known Risks and Decisions

- The prototype is CDN/Babel-based and should not be used as production runtime code.
- Several CSS variables referenced by the prototype are missing and must be defined during implementation.
- Variant files mix Korean and English copy; choose Korean-first copy before building.
- Some prototype screens use `Math.random()` in render; production must use stored or seeded data.
- The design has four alternate directions. Building every variant as separate product modes would increase scope without improving MVP clarity.

## 9. Estimated Build Order

1. Project scaffold and design tokens.
2. Shared layout and UI components.
3. Data schema and seed data.
4. Chart components.
5. Dashboard.
6. Today Log.
7. Distance and Calendar.
8. Health and Screen Golf.
9. Persistence, validation, and responsive polish.
10. QA pass against the original wireframes.
