# Video-discussion L3 specs

These specs drive `chatType: "video"` stages end-to-end against **real Daily.co**
infrastructure (option C from the #49 scoping discussion). They live in their
own directory so they can be excluded from the default `npm run test:e2e` and
gated to a separate workflow that only runs nightly + on demand.

## Why isolated

- **Cost**: Daily charges per participant-minute. Free tier is 10,000/month.
  Nightly + ad-hoc runs comfortably fit within free tier as long as
  `videoStorage: "none"` (recording disabled) is the default in test
  treatments.
- **Flakiness**: real WebRTC over real network. Tight timeouts + 1 retry max
  in `playwright.e2e.video.config.mjs` keeps blast radius bounded.
- **Credentials**: `DAILY_APIKEY` is required. Tests skip with a clear message
  when unset (so contributors without creds aren't blocked locally).

## Running

```bash
# All video specs
npm run test:e2e:video

# A single spec by file
npx playwright test -c playwright/playwright.e2e.video.config.mjs smoke

# UI mode for debugging
npm run test:e2e:video:ui
```

## CI

`.github/workflows/playwright_e2e_video.yml` runs these specs:
- Nightly via cron
- On-demand via `workflow_dispatch`

Not run on every PR. Not required for merge. The default `playwright_e2e.yml`
excludes this directory via `testIgnore` in `playwright.e2e.config.mjs`.

## Coverage approach

- **L1 / L2** still cover the bulk of Daily integration. The 101 mocked
  component tests in `playwright/component-tests/video-call/mocked/` exercise
  the call-lifecycle / device-alignment / sentry / participant-tracking
  surface against a stub `MockCallObject`. Server-side provider unit tests
  pin URL / auth / parsing contracts (`server/src/providers/dailyco.test.js`).
- **L3 (this dir)** is the integration-only layer: it confirms that real
  Daily room URLs flow through the platform, real participants establish
  WebRTC, and platform behaviors that *only* trigger over a real call
  (cross-participant check-in counting, ReportMissing flow, etc.) work.

## Don't add to this dir

Specs that don't need a live Daily room. If a test can be written with
`chatType: "text"` or with the existing server-side Daily mock
(`playwright/e2e/_helpers/mockExternalServer.mjs`), it belongs in the
default `e2e/` tree.
