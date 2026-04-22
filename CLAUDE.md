# Deliberation Lab — Claude Context

Small-group deliberation experiment platform built on [Empirica](https://empirica.ly/). Participants join via a React client; a Node.js server handles game lifecycle, external integrations, and data export.

## AI Assistant Model Selection

**Default Model**: This project uses **Claude Sonnet** by default for cost efficiency and speed.

**Model Warning**: If you detect that Opus is being used but the user hasn't explicitly switched to it (via `/model opus`), warn the user before performing any tasks. Ask if they intended to use Opus or if they'd like to switch to Sonnet.

**When to use Opus**: Only switch to Opus when the user explicitly requests it for tasks requiring maximum reasoning capability (complex architectural decisions, debugging intricate logic, etc.).

## Repo Structure

- `client/src/` — React UI: `App.jsx` (intro/exit), `Stage.jsx` / `Game.jsx` (game stages), `components/` (platform components incl. `discussion/` for video + text chat, `stagebookAdapter/` that bridges Empirica ↔ stagebook, `stageCoherence/` that gates in-game rendering on stage-transition consistency). DSL element rendering (prompts, surveys, etc.) is provided by the external `stagebook` npm package — NOT local code.
- `server/src/` — Empirica callbacks (`callbacks.js`); `preFlight/` (batch-config validation, dispatch, preregistration — DSL validation is delegated to stagebook); `postFlight/` (science/payment/participant JSONL exports); `providers/` (Daily, Qualtrics, Etherpad, GitHub, Sentry, CDN); `utils/` (shared export helpers).
- `cypress/e2e/` — End-to-end tests; treat these as the ground truth for expected behavior. Update specs when behavior changes.
- Unit / component tests run via vitest (server + client) and Playwright CT; see `playwright/component-tests/` and colocated `*.test.js` files.
- `docs/` — Researcher-facing docs (published to ReadTheDocs)

## Dev Commands

```bash
npm run build      # install deps + copy default.env → .env (run once)
npm run start      # start Empirica server + mock CDN (localhost:3000)
npm run lint       # ESLint (airbnb config) across client/src, server/src, cypress
npm run test       # open Cypress test runner (cd cypress && npx cypress open)
```

Admin UI: `http://localhost:3000/admin`

## Tools

- **GitHub**: Use `gh` CLI for all GitHub workflows — viewing issues, creating PRs, reading and responding to PR review comments. Paste issue/PR URLs or numbers directly into the conversation.
- **Sentry**: `sentry-cli` is installed and authenticated (`~/.sentryclirc`). Org: `watts-lab`, project: `deliberation-empirica`. Use it to list events, query issues, etc. For full event JSON exports, use the Sentry web API with the same auth token. Sentry MCP is also configured but may need re-authentication.

## Component Tests (Playwright)

101 mocked component tests for the `call/` subsystem live in `playwright/component-tests/video-call/mocked/`.
They run without a real Daily.co connection — everything is mocked.

```bash
# Run all video-call component tests
npx playwright test --config playwright/playwright.config.mjs "video-call/mocked"

# Run a specific test file
npx playwright test --config playwright/playwright.config.mjs "video-call/mocked/FixAV"

# Run a single test by name grep
npx playwright test --config playwright/playwright.config.mjs "video-call/mocked/Speaker" --grep "SPEAKER-004"
```

**Test file → feature mapping:**
| File | Feature area |
|---|---|
| `FixAV.ct.jsx` | Fix A/V modal + diagnosis flow |
| `Speaker.ct.jsx` | Speaker alignment + gesture prompt |
| `AudioContext.ct.jsx` | AudioContext suspension recovery |
| `Subscriptions.ct.jsx` | Subscription drift + repair heartbeat |
| `PermissionMonitoring.ct.jsx` | Browser permission change events |
| `Tile.ct.jsx` / `Tray.ct.jsx` | UI components |
| `ErrorReporting.ct.jsx` | Sentry captures |
| `VideoCall.historyAndData.ct.jsx` | dailyIdHistory + avReports |
| `DeviceAlignmentLogs.ct.jsx` | Device alignment log spam |
| `VideoCall.deviceAlignment.ct.jsx` | Device ID alignment effect |

**In-page test controls (via `page.evaluate`):**

- `window.mockCallObject._audioEnabled = false` — simulate muted mic
- `window.mockCallObject._videoEnabled = false` — simulate muted camera
- `window.mockCallObject._audioReadyState = 'ended'` — simulate ended mic track
- `window.mockCallObject._videoReadyState = 'ended'` — simulate ended camera track
- `window.mockCallObject._updateParticipantsCalls` — inspect `updateParticipants` call log
- `window.mockDailyDeviceOverrides = { setSpeaker: () => Promise.reject(...) }` — override device calls
- `window.mockSentryCaptures` — inspect Sentry captures (`.messages`, `.breadcrumbs`, `.exceptions`)
- `window.triggerPermChange('camera', 'denied')` — fire synthetic permission change (after `installPermissionsMock`)

**Progress tracking:** `playwright/component-tests/video-call/TEST-PROGRESS.md`

## Key Conventions

- **Tests are spec**: Cypress e2e tests define expected UX and data outputs. Any behavior change requires updating the relevant test.
- **Linting**: ESLint airbnb + prettier. Run `npm run lint` before committing.
- **Environment**: Secrets live in `.env` (gitignored). `default.env` has safe placeholders. External services (Daily video, Qualtrics, Etherpad, GitHub) need real keys in `.env`.
- **State storage**: Empirica state is in `./empirica/local/tajriba.json`. Delete to reset local state.
- **Empirica patterns**: Game state via `game.get()`/`game.set()`, player state via `player.get()`/`player.set()`. Server callbacks in `server/src/callbacks.js`.
