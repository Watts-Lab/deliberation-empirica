# Video Call Module (Daily + Empirica)

This directory contains the client code that renders and manages the participant video call. It wraps Daily.co primitives, synchronizes with Empirica game/stage state, and provides layout helpers.

## Entry points

- `VideoCall.jsx` — Main container used by stages with `discussion.chatType: "video"`. Responsibilities:
  - Joins/leaves the Daily room from `game.get("dailyUrl")`.
  - Mirrors Empirica player name/title into Daily display names.
  - Tracks and stores Daily session IDs on the player for later matching (`dailyId`, `dailyIds`).
  - Emits `callStarted` to the stage to trigger server-side recording.
  - Handles device errors, stage advancement hooks, and renders `Call` + `Tray` UI.
  - Enables centralized event logging via `useDailyEventLogger`.
- `Call.jsx` — Presents the video grid and participant tiles using layout helpers. Consumes Daily state and layout definitions to place feeds.
- `Tray.jsx` — Bottom control bar for toggling mic/camera/screen share, call leave, etc.

## UI building blocks

- `Tile.jsx` — Single participant video tile wrapper (video element, name/title badges, state indicators).
- `Icons.jsx` — SVG/icon components shared across call UI.
- `UserMediaError.jsx` — Inline error display for device/permission failures.

## Hooks

- `hooks/eventLogger.js` — Centralized logging of Daily events into Empirica stage data:
  - `useDailyEventLogger` logs audio/video mute/unmute, join/leave, network metrics.
  - `useStageEventLogger` logs stage-level events with stage-relative timestamps.
  - Both prefer stage timer timecodes to keep analytics aligned with stage duration.

## Layouts

- `layouts/computePixelsForLayout.js` (+ test) — Given a grid definition and feed list, computes pixel positions/sizes for tiles.
- `layouts/defaultResponsiveLayout.js` (+ test) — Default layout generator that adapts grid and feed arrangement to viewport size and participant count.

## How components fit together

1. `VideoCall` mounts, joins the Daily room, and signals `callStarted`.
2. Daily event logging is enabled via `useDailyEventLogger`.
3. `Call` renders the grid using layout helpers and `Tile` for each participant feed.
4. `Tray` provides local controls; interactions are reflected in Daily state and logged.
5. Device or join errors surface through `UserMediaError`.

Use `VideoCall` at the stage level; other components are internal wiring for the video experience. Tests for layout math live alongside the helpers in `layouts/`.
