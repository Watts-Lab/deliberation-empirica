# Cypress E2E Tests

This folder contains end-to-end tests that exercise Deliberation Lab as a user would: creating batches, running through intro/setup, playing stages (chat/video/prompts/surveys), handling edge cases (dropouts, cancellations), and verifying exports. The tests double as a living specification: observed test behavior is the source of truth for how the app should work.

## Structure

- `cypress.config.js` — Cypress configuration (base URL, video/screenshots settings, etc.).
- `e2e/` — Test specs:
  - `01_Normal_Paths_Omnibus.js` — Comprehensive happy-path covering intro, prompts, surveys, discussion, exit, and data export assertions.
  - Other numbered specs (e.g., dropouts, cancellations, chat, video layouts, etherpad/Qualtrics, many players/games) target specific flows and edge cases.
- `fixtures/` — Mock CDN assets (treatment files, prompts, media) used by tests.
- `support/` — Custom commands and shared steps:
  - `commands.js` / `sharedSteps.js` define helper flows (consent, setup checks, QC, entering lobby, sending chat, etc.).
  - `e2e.js` bootstraps global hooks.

## How tests map to behavior

- Each spec drives two or more simulated participants through the UI, asserting DOM states, network calls, and resulting data files (`*.scienceData.jsonl`, prereg, payment, postflight).
- Assertions in these tests are definitive: if docs and tests disagree, the tests define expected behavior. Update tests when behavior changes; treat them as executable documentation.
- Tests cover both text chat and video discussion modes, prompts/surveys/Qualtrics, conditional rendering, timers, and batch lifecycle (start/stop/close).

## Running

- From repo root: `npm run cypress:open` (interactive) or `npm run cypress:run` (headless), depending on package scripts.
- Ensure the app/server and mock CDN assets are available per test setup (see `support/sharedSteps.js` for how batches and players are initialized).

## Adding tests

- Prefer high-level, scenario-based specs that reflect real study flows.
- Reuse helpers in `support/sharedSteps.js` for consistency.
- When adding new features, codify expected behavior here; this becomes the canonical reference for future contributors and docs.
