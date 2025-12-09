# PreFlight

Validation, templating, and preregistration logic that runs before and during batch creation.

## Validation

- `validateTreatmentFile.ts` (+ tests) — Zod schema for treatments, elements, conditions, discussions, templates, intro/exit steps. Ensures treatment files are structurally valid; used in `getTreatments`.
- `validateBatchConfig.ts` (+ tests) — Zod schema for batch configs (cdn, treatments list, payoffs/knockdowns, repos, video storage, launchDate, etc.). Throws aggregated errors on failure.
- `validatePromptFile.ts` (+ tests) — Validates prompt markdown files (metadata, body, responses).
- `validateDlConfig.ts` (+ tests) — Validates `dlconfig.json` (deliberation assets config).

## Templating

- `fillTemplates.js` (+ tests) — Expands treatment/templates placeholders and broadcast contexts, ensuring all `${fields}` are resolved before validation.

## Dispatch

- `dispatch.js` (+ tests) — Assignment engine that groups participants into treatments/positions based on payoffs/knockdowns and eligibility conditions.
- Implements scoring/knockdown logic and searches for feasible groupings; used by callbacks during batch runtime.

## Preregistration & checks

- `preregister.js` — Builds and stores preregistration lines (treatment metadata, hashes) when players are assigned.
- `preFlightChecks.js` — Ensures required environment variables and external prerequisites are present on server start.

These modules are imported by `getTreatments`, batch creation handlers, and runtime callbacks to ensure experiments are valid, templates expanded, and assignments/preregistrations handled correctly before players enter the game.
