// Playwright e2e config for video-discussion specs (Daily.co integration).
//
// Why a separate config: the dropout / video-discussion L3 specs need real
// Daily credentials + WebRTC negotiation in a real browser, which costs
// participant-minutes and depends on Daily's network. Running them on every
// PR is overkill (Daily's free tier is generous but not infinite, and a
// real-network test will inevitably flake) — they belong on a gated workflow
// (`.github/workflows/playwright_e2e_video.yml`: manual + nightly cron).
//
// Cost ballpark with `videoStorage: "none"` in test treatments: each test
// run is ~3 participant-minutes (3 players × 1 min). Daily's free tier is
// 10,000 participant-minutes/month — comfortably covers nightly + ad-hoc
// runs as long as recording stays disabled. Recording is opt-in per test.
//
// What's the same as playwright.e2e.config.mjs: testDir, globalSetup,
// reporter shape, retries. Diffs:
//   - `testDir`/`testMatch` scoped to e2e/video/
//   - `timeout` raised from 120s → 180s; real Daily handshake adds 5-15s
//     of cold-start latency that the default budget would race
//   - `permissions: ["camera", "microphone"]` + `--use-fake-{ui,device}-
//     for-media-stream` launchOptions so headless Chromium accepts
//     getUserMedia without prompting
//   - chromium-only (same as default e2e — no cross-browser coverage)

import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: "./e2e/video",
  testMatch: "**/*.spec.{js,ts,mjs}",
  testIgnore: ["**/_helpers/**", "**/fixtures/**"],

  timeout: 180_000,
  expect: { timeout: 15_000 },

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Serial in CI to avoid stacking concurrent Daily room creates against the
  // free tier and to keep a hung WebRTC handshake from spending minutes in
  // parallel across workers. Local dev can override with --workers=N.
  workers: process.env.CI ? 1 : 1,

  globalSetup: path.resolve(__dirname, "./e2e/_helpers/globalSetup.mjs"),

  reporter: [
    ["html", { outputFolder: "playwright-report-e2e-video" }],
    ["list"],
  ],

  use: {
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    permissions: ["camera", "microphone"],
    launchOptions: {
      args: [
        // Auto-grant camera / mic access (no permission prompt).
        "--use-fake-ui-for-media-stream",
        // Synthetic media tracks (rotating square + tone) so Daily's
        // getUserMedia call resolves without real hardware. Same flags
        // the existing component-test config uses for video-call mocked.
        "--use-fake-device-for-media-stream",
      ],
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
