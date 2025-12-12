# Utils

Shared utility functions for the server.

- `comparison.js` — Helper(s) for comparing arrays/objects (used in matching/dispatch logic).
- `logging.js` — Log helpers (e.g., `logPlayerCounts`) that read player/game state and produce structured console output.
- `math.js` (+ `math.test.js`) — Numeric helpers:
  - `valueCounts`, `mean`, `median`, `percentile`, etc., used in reports/dispatch.
- `reference.js` — Resolves reference strings (e.g., `prompt.foo`, `survey.bar.responses`) against player/game/stage scopes; used for condition evaluation and display rendering.

These utilities are imported across callbacks, dispatch, reporting, and validation code to avoid duplicating common math/reference resolution and logging patterns.
