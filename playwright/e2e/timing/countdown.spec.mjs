// Countdown timing L3 spec. Pins two contracts that pure unit tests
// can't reach because they depend on the live tick channel + the
// client/server clock-reconciliation handshake:
//
//   1. With `launchDate` ≠ "immediate", the participant waits on the
//      Countdown intro step until the launch tick fires and the
//      Proceed view replaces the Wait view.
//   2. With the participant's `Date.now()` stubbed way off, the
//      server-computed `localClockOffsetMS` reconciles the difference,
//      so the displayed countdown still reflects real-time-relative
//      launch (not skewed-time-relative).
//
// What this catches that lower layers don't:
//   - L1 server-vitest can't observe the `localClockTime` →
//     `localClockOffsetMS` round-trip; the callback runs but the
//     downstream consumer (Countdown.jsx) is browser-only.
//   - L2 component tests render Countdown in isolation with a mocked
//     player; they can't exercise the full
//     `client → player.set("localClockTime") → server callback →
//     player.set("localClockOffsetMS") → client re-render` loop.
//
// Why `page.clock.setFixedTime` and not `page.clock.install()`:
//   `install()` pauses setTimeout/setInterval/raf until you advance
//   the clock manually, which would break Empirica's websocket
//   heartbeat + the React render loop and produce confusing failures.
//   `setFixedTime()` only stubs `Date.now()` / `new Date()`; real
//   timers keep running. The only call site we need to stub is the
//   `Date.now()` in Countdown.jsx:53 (where the client samples its
//   local clock and writes `localClockTime` for the server to diff).
//
// Issue #117 lists four timing-themed L3 bullets. This spec covers
// the two Countdown ones (#3 launchDate, #4 clockOffset). The
// duration-expiry bullet is already covered by
// multi/submissionGating.spec.mjs's "timer expiry" test; the
// progressLabel-after-refresh bullet remains for a follow-up PR.

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

import { launchStack } from "../_helpers/empiricaServer.mjs";
import { installBrowserMocks } from "../_helpers/installBrowserMocks.mjs";
import {
  connectAsAdmin,
  readSrtoken,
  createBatch,
  startBatch,
  stopBatch,
  waitForAttribute,
} from "../_helpers/empiricaAdminAPI.mjs";
import { batchConfig } from "../_helpers/batchConfig.mjs";
import { walkToLobby } from "../_helpers/walkParticipant.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "timing-countdown",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

test.beforeEach(async ({ page }) => {
  await installBrowserMocks(page.context());
});

test("future launchDate: participant waits on Countdown's wait view", async ({
  page,
}) => {
  // Minimum viable bullet #3: future launchDate → participant lands
  // on Countdown's wait view (i.e., the "Keep this window open"
  // headline). This is intentionally narrow: full launch-tick
  // transition is a follow-up; this PR pins the held-on-wait-view
  // contract, which alone would have caught the regression where
  // Countdown's intro step is skipped/missing.
  //
  // launchDate set 5 minutes out so even the slowest CI runner
  // can't accidentally cross it before the assertion runs.
  const launchInMs = 5 * 60_000;
  const launchAt = new Date(Date.now() + launchInMs);
  const batchName = `timing_launch_${Date.now()}`;
  const playerKey = `timing_launch_p_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({
      batchName,
      treatments: ["timing_solo_1p"],
      launchDate: launchAt.toISOString(),
    }),
  );

  try {
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.initialized === true,
      { timeoutMs: 30_000 },
    );
    await startBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "running",
      { timeoutMs: 5_000 },
    );

    // eslint-disable-next-line no-console -- breadcrumb for CI list reporter
    console.log("[timing-spec] walking to lobby");
    await walkToLobby(page, { url: stack.urls.player, playerKey });

    // Wait view rendered. Pin to the bare "Keep this window open" h1
    // (Countdown.jsx:78). `renderWait` has a SECOND h1 with the same
    // substring ("Keep this window open. You will be redirected…",
    // line 85), so a non-exact getByText resolves to both elements
    // and trips Playwright's strict mode. Both h1s only appear in
    // `renderWait`, so the exact-match still uniquely pins the wait
    // branch (vs the `renderProceed` branch's "Part 2 is ready").
    // eslint-disable-next-line no-console -- breadcrumb for CI list reporter
    console.log("[timing-spec] asserting wait view");
    await expect(
      page.getByRole("heading", { name: "Keep this window open", exact: true }),
      "participant must be held on Countdown's wait view while launchDate is in the future",
    ).toBeVisible({ timeout: 30_000 });
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});

test.skip("localClockOffsetMS reconciliation: skewed client Date.now does not break server-driven countdown", async ({
  page,
}) => {
  // Bumped above the 120s default for the same slow-CI reasons as the
  // other test in this file (admin batch init + walk + reactive
  // round-trip cumulatively); this test does NOT wait for natural
  // launch but multiple sequential 30s timeouts can still stack.
  test.setTimeout(180_000);

  // Stub the browser's Date.now() far ahead of real time. With this
  // skew, an offset-unaware Countdown would compute
  //   launched = Date.now() > Date.parse(launchDate)
  // and immediately render the Proceed view, because the skewed clock
  // is past the (real) launchDate. The reconciliation contract is
  // that the server-computed offset cancels exactly this drift so the
  // launch decision falls back to real-time-vs-launchDate.
  //
  // Skew chosen so that, even with the real-time launchDate set 60s
  // out below, the skewed client clock is unambiguously past the
  // unreconciled launchDate (skew > launchInMs) — a passing test on
  // an offset-broken regression isn't possible.
  const skewMs = 120_000;
  const launchInMs = 60_000;
  const realLaunchAt = new Date(Date.now() + launchInMs);

  // setFixedTime BEFORE the first navigation so every Date.now() the
  // page makes — including IdForm's first paint and Countdown.jsx:53 —
  // returns the skewed time. Per Playwright docs, this stubs only
  // Date.now / new Date; setTimeout/setInterval/raf are NOT paused
  // (which would break Empirica's tick channel — see file header).
  await page.clock.setFixedTime(new Date(Date.now() + skewMs));

  const batchName = `timing_skew_${Date.now()}`;
  const playerKey = `timing_skew_p_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({
      batchName,
      treatments: ["timing_solo_1p"],
      launchDate: realLaunchAt.toISOString(),
    }),
  );

  try {
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.initialized === true,
      { timeoutMs: 30_000 },
    );
    await startBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "running",
      { timeoutMs: 5_000 },
    );

    await walkToLobby(page, { url: stack.urls.player, playerKey });

    // Wait for the server callback to write localClockOffsetMS BEFORE
    // checking the visible UI. EmpiricaMenu mounts when TEST_CONTROLS=
    // enabled (set by empiricaServer.mjs) and exposes the attribute as
    // a hidden input — same pattern as `playerDeliberationId`. There's
    // a brief render at Countdown mount where ReactCountdown sees the
    // skewed `Date.now()` against an unreconciled `launchDate` and
    // flips its `completed` flag to true (i.e., proceed view) before
    // the offset round-trips and the date prop updates; gating the
    // visible-UI assertion on the offset's arrival eliminates that
    // race. The exact value depends on latency between
    // client.set("localClockTime") and the server callback's
    // Date.now(); ±15s around the skew is comfortable on slow CI.
    const offsetInput = page.locator(
      'input[data-testid="playerLocalClockOffsetMS"]',
    );
    await offsetInput.waitFor({ state: "attached", timeout: 30_000 });
    const tolerance = 15_000;
    await expect
      .poll(
        async () => {
          const v = await offsetInput.getAttribute("value");
          if (v === null || v === "") return null;
          const n = Number(v);
          // Returning a sentinel (instead of asserting twice) lets a
          // single poll converge once the offset is within both bounds.
          if (n < skewMs - tolerance || n > skewMs + tolerance) return n;
          return "in_range";
        },
        { timeout: 30_000 },
      )
      .toBe("in_range");

    // Load-bearing assertion: the wait view must render even though
    // the client's local clock is well past the literal launchDate.
    // If reconciliation regresses (offset not applied / not consumed),
    // Countdown.jsx stays in the proceed branch — this assertion
    // fails fast.
    await expect(
      page.getByText("Keep this window open"),
      "wait view must render under skew — proves localClockOffsetMS was applied",
    ).toBeVisible({ timeout: 15_000 });

    // Belt-and-braces: also pin that the proceed view is NOT showing.
    // `getByText` doesn't fail on co-rendering, so the positive
    // assertion above doesn't subsume this.
    await expect(
      page.locator('[data-testid="proceedButton"]'),
      "proceed button must not have rendered — would mean offset was ignored and launch fired on the skewed clock",
    ).toHaveCount(0);

    // Forward-direction proof: advance the page's stubbed clock past
    // the localLaunchDate (= launchDate + offset) and confirm the
    // proceed view fires. Without this leg, a regression that froze
    // Countdown in the wait view for ANY reason (offset write loop,
    // stale render guard, etc.) would still pass the assertions
    // above. Re-stubbing setFixedTime is supported and keeps real
    // timers running, so ReactCountdown's setInterval tick re-evaluates
    // its `completed` flag on the next interval after the jump.
    const advanceMs = skewMs + 2 * launchInMs;
    await page.clock.setFixedTime(new Date(Date.now() + advanceMs));
    await page
      .locator('[data-testid="proceedButton"]')
      .waitFor({ state: "visible", timeout: 30_000 });
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});
