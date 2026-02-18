# Deliberation Lab — Claude Context

Small-group deliberation experiment platform built on [Empirica](https://empirica.ly/). Participants join via a React client; a Node.js server handles game lifecycle, external integrations, and data export.

## Repo Structure

- `client/src/` — React UI: `App.jsx` (intro/exit), `Stage.jsx` (game stages), `elements/` (stage elements), `call/` (Daily video), `components/` (shared UI)
- `server/src/` — Empirica callbacks (`callbacks.js`), `preFlight/` (validation/templating), `postFlight/` (exports), `providers/` (Daily, Qualtrics, Etherpad, GitHub)
- `cypress/e2e/` — End-to-end tests; treat these as the ground truth for expected behavior. Update specs when behavior changes.
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
- **Sentry**: Sentry MCP is installed. Use it to fetch error events, look up issues by ID, search for recent errors, etc.

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
