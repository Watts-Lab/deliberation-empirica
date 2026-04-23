# PreFlight

Dispatch, preregistration, and startup-check logic that runs before and during
batch creation.

## Validation (delegated to stagebook)

Treatment-file / prompt-file structural validation + template expansion live in
the external `stagebook` package. `server/src/getTreatments.js` imports
`treatmentSchema`, `promptFileSchema`, and `fillTemplates` from it. Local
validators (`validateTreatmentFile.ts`, `validatePromptFile.ts`,
`fillTemplates.js`) were removed in the stagebook migration.

- `validateBatchConfig.ts` (+ tests) — Zod schema for batch configs (cdn,
  treatments list, payoffs/knockdowns, repos, video storage, launchDate, etc.).
  Platform-specific; stays local. Throws aggregated errors on failure.
- `validateDlConfig.ts` (+ tests) — Validates `dlconfig.json` (deliberation
  assets config). Platform-specific; stays local.

## Dispatch

- `dispatch.js` (+ tests) — Assignment engine that groups participants into
  treatments/positions based on payoffs/knockdowns and eligibility conditions.
- Implements scoring/knockdown logic and searches for feasible groupings; used
  by callbacks during batch runtime.

## Preregistration & checks

- `preregister.js` — Orchestrator that builds and writes the preregistration
  JSONL line when a player is assigned.
- `preregisterHelpers.js` — Pure builders for the JSONL row shape
  (sampleId / treatmentHash / exportErrors).
- `preFlightChecks.js` — Ensures required environment variables and external
  prerequisites are present on server start.

These modules are imported by `getTreatments`, batch creation handlers, and
runtime callbacks to ensure experiments are valid, templates expanded (via
stagebook), and assignments/preregistrations handled correctly before players
enter the game.
