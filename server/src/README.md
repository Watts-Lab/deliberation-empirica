# Server Overview

Empirica server logic for Deliberation Lab: batch setup, participant dispatch, callbacks, external providers, and data export.

## Entry point

- `index.js` — Initializes Empirica with the exported `Empirica` listener collector from `callbacks.js`.

## Core callbacks (`callbacks.js`)

Central event handlers for server lifecycle:

- **Startup**: `on("start")` checks required env vars, GitHub auth, and sets CDN globals.
- **Batch lifecycle**:
  - `on("batch")`: validate batch config; load treatments/intro sequence; run Daily check if needed; set filenames/labels; validate repo access; push test file; initialize dispatcher.
  - `on("batch","status")`: handle transitions; on `terminated/failed`, close batch and generate postflight report.
- **Dispatch**:
  - `runDispatch` via `dispatch.js` to assign ready players into games; `debounceRunDispatch` waits `dispatchWait` seconds.
  - Tracks dispatch timers and dispatcher per batch.
- **Game lifecycle**:
  - `on("game")`: assign players to game and start.
  - `on("game","start")`: preregister samples; add stages; create Daily room and set recording metadata.
  - `on("game","ended")`: set end time; stop recording/close room; save recordingsPath.
  - `scrubGame`: reset players on failure and re-run dispatch.
  - `onStageEnded` hooks start/stop recording for video discussions.
- **Player lifecycle**:
  - Initialize player on connect (bind to batch, set participantData, consent info).
  - Track connections/disconnections (`connectionHistory`).
  - Log intro milestones (`timeIntroDone`, countdown entry).
  - Handle `playerComplete`: set `exitStatus`, `timeComplete`, and trigger close-out.
  - Handle Qualtrics data ready (fetch and store).
  - Report missing/check-in flows (via `ReportMissing` UI) are logged.
- **Close-out**:
  - `closeOutPlayer` writes science data (`exportScienceData`), payment data, and marks `closedOut`.
  - `closeBatch` closes remaining players (marking `incomplete`), runs postflight report, prints payment data, clears timers.

Supporting maps/sets track dispatchers, timers, player/batch mappings, and online participants.

## Treatment loading

- `getTreatments.js`: fetches treatment file from CDN, fills templates, validates via `validateTreatmentFile`, validates prompt files, ensures Qualtrics metadata fetch, and returns selected treatments + intro sequence. Used during batch init.
- `validateConfig.js`: legacy config validator.

## Pre-flight modules (`preFlight/`)

- Validation: `validateTreatmentFile.ts`, `validateBatchConfig.ts`, `validatePromptFile.ts`, `validateDlConfig.ts`.
- Templating: `fillTemplates.js`.
- Dispatch: `dispatch.js` (assignment engine).
- Preregistration: `preregister.js`.
- Env checks: `preFlightChecks.js`.
See `preFlight/README.md` for details.

## Post-flight modules (`postFlight/`)

- Exports: `exportScienceData.js`, `exportPaymentData.js`, `exportParticipantData.js`.
- Reporting: `postFlightReport.js`.
See `postFlight/README.md`.

## Providers (`providers/`)

- External integrations: CDN, Daily.co, Etherpad, GitHub, Qualtrics. See `providers/README.md`.

## Utilities

- `utils/` helpers (`reference`, `math`, `logging`, `comparison`).
- `utils.js`: array helpers (`toArray`, etc.) and batch utilities (`selectOldestBatch`, `getOpenBatches`).

## Data directories

- Filenames for exports are set per batch in `callbacks.js` using `DATA_DIR` (scienceData, prereg, payment, postflight).

## Behavior contract

Server callbacks, dispatch, and exporters together define the system’s runtime behavior. When changing participant flow, data capture, or external integrations, update the relevant callbacks and tests to keep the behavior contract intact. README files in subfolders summarize specific domains.
