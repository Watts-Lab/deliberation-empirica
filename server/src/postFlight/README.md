# PostFlight

Exports and reporting after (or as) participants complete sessions and batches close.

## Exports

- `exportScienceData.js` — Builds the per-participant science data record and appends it to the batch `*.scienceData.jsonl` file. Includes identifiers, config snapshot, timings, consent, intro/exit results, surveys/prompts/qualtrics, recordings info, chat/speaker events, reports/check-ins, stage timings, etc. Pushes to GitHub via `providers/github`.
- `exportPaymentData.js` — Writes payment data for each participant (including URL params, connection info) to a per-batch file; sets `paymentDataFilename` on the player.
- `exportParticipantData.js` — Helper to gather participant metadata used during preregistration and elsewhere.

## Reporting

- `postFlightReport.js` — Generates a summary report when a batch closes (counts, timings, QC summaries, connection stats, reports/check-ins) and pushes it to prereg repos when configured.

These modules are invoked by callbacks when participants finish (`closeOutPlayer`) and when batches terminate, ensuring data is persisted locally and pushed to configured repositories.
