# Providers

External service integrations used by the server. Each module encapsulates API calls and validation for a specific provider.

- `cdn.js` — Fetches text/assets from the configured CDN (Deliberation assets bucket or localhost); used to load treatment files, prompts, etc.
- `dailyco.js` — Wraps Daily.co REST APIs for room lifecycle and recording:
  - `createRoom`, `getRoom`, `startRecording`, `stopRecording`, `closeRoom`, `dailyCheck`.
  - Handles S3 recording bucket configuration and retries when calls occur before a room is active.
- `etherpad.js` — Creates/fetches Etherpad pads and contents for shared notepads in prompts.
- `github.js` — GitHub commit/push helpers:
  - Auth check, tree retrieval, repo/branch validation.
  - Commit files (scienceData, prereg, postflight) with retries, used by postflight exporters and preregistration.
- `qualtrics.js` — Fetches Qualtrics survey responses via API, turning `sessionId` into `responseId` and retrieving the response payload.

Provider modules are used by callbacks and pre/post-flight code to keep third-party interactions isolated from core logic. Configure required environment variables (tokens, URLs, buckets) before invoking these helpers.
