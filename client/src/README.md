# Client App Overview

React client for Deliberation Lab. Stagebook ([npm: `stagebook`](https://www.npmjs.com/package/stagebook)) renders treatment-driven stages, prompts, and DSL conditional logic; this repo provides the platform around it — intro/exit lifecycle, video/text discussion infrastructure, external-service integrations, and admin/dev tooling.

## Entry points

- `index.jsx` — React mount, Sentry setup, error boundary, bug-report dialog.
- `App.jsx` — Top-level routing: browser compat checks, Empirica provider tree, intro sequence, game, exit sequence.
- `Game.jsx` — Live-game chrome (profile header + stage area, stale-state recovery).
- `Stage.jsx` — Wraps stagebook's `<Stage>` in the platform's `StagebookProviderAdapter` + `StageProgressLabelProvider`.
- `Profile.jsx` — Header bar shown during game stages (title + timer).

## Key feature areas

- `intro-exit/` — All orchestration outside a running game stage: consent, ID capture, nickname, attention check, countdown, lobby, debrief, and the `setup/` equipment checks. Includes `GenericIntroExitStep.jsx` which renders treatment-defined intro/exit steps through stagebook's `<Stage>`.
- `elements/` — Components wired into stagebook's platform-slot API: `Discussion.jsx` (video or text chat), `Survey.jsx` (@watts-lab/surveys). Other platform slot `SharedNotepad.jsx` lives in `components/` for historical reasons.
- `components/` — Platform UI + adapters: `StagebookProviderAdapter.jsx` and its helpers, `IdleProvider`, `Alert`, `Modal`, `Toast`, `Select`, `ConfirmLeave`, `ConditionalRender` (dev + browser-compat only), `EmpiricaMenu`, `PermissionRecovery`, `Markdown` wrapper, platform hooks, and `progressLabel/` provider.
- `call/` — Video call UI (Daily.co integration). Used exclusively by `elements/Discussion.jsx`.
- `chat/` — Text chat UI. Used exclusively by `elements/Discussion.jsx`.
- `utils/` — Sentry filtering helpers.

## Stagebook integration

Stagebook renders all DSL elements (`prompt`, `submitButton`, `display`, `timer`, `trackedLink`, `audio`, `image`, `mediaPlayer`, `separator`, `qualtrics`) and handles all condition-based / time-based / position-based / submission-based rendering internally.

The platform supplies the `StagebookContext` via `components/StagebookProviderAdapter.jsx`, which translates Empirica's hook-based state (`usePlayer`, `useGame`, `usePlayers`, `useGlobal`) into stagebook's `get(key, scope)` / `save(key, value, scope)` / `getAssetURL(path)` / `getTextContent(path)` contract. Pure logic is extracted into `components/stagebookAdapterHelpers.js` and unit-tested.

Platform-supplied render slots (`renderDiscussion`, `renderSurvey`, `renderSharedNotepad`) cover element types stagebook can't ship on its own (external services, Empirica-specific wiring).

## Data flow & logging

- Empirica hooks (`usePlayer`, `useStage`, `useGame`) read/write attributes throughout.
- Stagebook writes its own keys (`prompt_*`, `survey_*`, `submitButton_*`, `trackedLink_*`, `audio_*`, `video_*`, `qualtrics_*`) via the adapter's `save()`. Platform-specific writes (setup steps, connection info, check-ins, reports) use `player.set()` directly.
- Discussion logging: video events via `call/hooks/eventLogger`; chat actions written by `chat/` components.
- Progress labels (intro_N_name / game_N_name / exit_N_name) are derived in `components/progressLabel/` and stamped onto every stagebook save.

## External services

- **Daily.co** for video — joined via `dailyUrl` set on the stage; see `call/`.
- **@watts-lab/surveys** for structured surveys — invoked via stagebook's `renderSurvey` slot.
- **Etherpad** for shared notepads — invoked via stagebook's `renderSharedNotepad` slot.
- **Qualtrics** — stagebook embeds the iframe; server validates the survey metadata during treatment load.

Use this overview to navigate the client code. Each subfolder README dives deeper into its role.
