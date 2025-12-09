# Client App Overview

This directory contains the React client for Deliberation Lab. It renders intro/exit flows, game stages, discussions (video/text), and shared UI. Empirica provides game/player/stage context; Daily.co powers video; data is logged to player/stage/game attributes for export.

## Entry points

- `App.jsx` — Top-level router that loads batch globals, intro sequence, main game, and exit sequence. Composes intro/exit steps and hands off to `Stage` for live game stages.
- `Stage.jsx` — Renders a single game stage: discussion (if configured) and stage `elements` via `elements/Element`.

## Key feature areas

- `intro-exit/` — Intro/onboarding and exit/debrief flows. Includes consent, ID capture, setup checks, attention/QC surveys, lobby/countdown, and generic intro/exit page rendering. See `intro-exit/README.md` and `intro-exit/setup/README.md`.
- `elements/` — Stage element components mapped from treatment `type` values (prompt, survey, qualtrics, display, timers, etc.). See `elements/README.md`.
- `components/` — Shared UI primitives (inputs, markdown, conditional renderers, shared notepad, timers, hooks, reference resolver). See `components/README.md`.
- `call/` — Video call UI built on Daily (joining, layout, tray controls, logging). See `call/README.md`.
- `chat/` — Text chat UI with reactions and action logging. See `chat/README.md`.

## Data flow & logging

- Empirica hooks (`usePlayer`, `useStage`, `useGame`) are used throughout to read/write attributes.
- Actions and responses are stored on player/stage/game scopes with names aligned to treatment types (e.g., `prompt_*`, `survey_*`, `submitButton_*`, `chat` actions, `setupSteps`).
- Discussion logging: video events via `call/hooks/eventLogger`; chat actions via `chat` components.

## Conditional display & timing

- `components/ConditionalRender` wraps elements for:
  - Time-based gating (`displayTime`/`hideTime`)
  - Position-based gating (`showToPositions`/`hideFromPositions`)
  - Condition-based gating (treatment `conditions`)
- Stage timers (`useStageTimer`) and local timestamps track elapsed seconds for logging (e.g., prompt `stageTimeElapsed`, submit button timings).

## External services

- Daily.co for video calls (env/config set on server; client joins via `dailyUrl`).
- Qualtrics embedding/fetch (via `elements/Qualtrics` when configured).
- CDN asset loading for prompts/media via hooks in `components/hooks.js`.

Use this overview to navigate the client code. Each subfolder README dives deeper into its components and responsibilities. 
