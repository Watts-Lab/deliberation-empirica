Local scratch space for generated data (scienceData, preregistration, payment, postflight reports) when running the server or Cypress tests. Files here are gitignored; keep the folder but do not commit its contents. Delete files as needed between runs to avoid reading stale outputs. Some tests expect this directory to exist to write `batch_*.scienceData.jsonl` fixtures.

Additional local artifacts you may see here:

- `empirica.log`: server log output for your local run; useful for debugging batch creation, dispatch, Daily/Qualtrics interactions, and export events.
- `tajriba.json`: full Tajriba state transaction log (the Empirica backend). It records every state change and event; treat it as the authoritative ledger of study state and timing. Useful for deep forensics or replaying scenarios, but not an easy read.
