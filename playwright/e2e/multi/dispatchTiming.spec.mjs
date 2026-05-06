// Dispatch-timing L3 spec. Pins the platform contract that:
//
//   1. The first introDone arrival starts a `dispatchWait` timer.
//   2. The dispatcher fires once that timer expires (NOT immediately
//      on quorum), and a single timer cycle covers both players —
//      i.e. the timer is debounced from the first arrival, not
//      restarted by every subsequent introDone.
//
// Approach: spin up a 2-player treatment with `dispatchWait: 5`,
// walk one participant first, then deliberately stagger the second
// walk ~3s later (still well inside the 5s window). Read three
// server-stamped timestamps:
//   - playerA.timeIntroDone, playerB.timeIntroDone (server clock at
//     each introDone callback)
//   - game.timeGameStarted (server clock at game-start callback)
//
// Why a deliberate stagger instead of parallel walks: the load-bearing
// upper-bound assertion needs to discriminate the correct path
// (`dispatchDelay ≈ dispatchWait`) from the timer-reset regression
// (`dispatchDelay ≈ stagger + dispatchWait`). With parallel walks the
// stagger is sub-second, so both paths land in the same ballpark and
// the assertion is toothless. With a 3s stagger the regression delay
// is ~8s vs the correct 5s, and the upper bound below cleanly
// separates them.
//
// What this catches that lower layers don't:
//   - L1 dispatcher tests (`server/src/preFlight/dispatch.{...}.test.js`)
//     verify the assignment algorithm in isolation — given a player
//     set, they don't observe the orchestration in
//     `callbacks.js::debounceRunDispatch` that decides WHEN dispatch
//     fires. A regression where the timer is removed (dispatch
//     immediate) or reset on each arrival (≥ 2× the configured wait)
//     would slip past every L1 test.
//   - Other multi/ specs use the default 1s dispatchWait and don't
//     verify the timing — they only verify outcomes (positions
//     assigned, treatments split, etc.).

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

import { launchStack } from "../_helpers/empiricaServer.mjs";
import {
  connectAsAdmin,
  readSrtoken,
  createBatch,
  startBatch,
  stopBatch,
  waitForAttribute,
  listScopes,
  getAttributes,
} from "../_helpers/empiricaAdminAPI.mjs";
import { batchConfig } from "../_helpers/batchConfig.mjs";
import { walkToGame } from "../_helpers/walkParticipant.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

// Long enough that a "fires immediately on quorum" or "timer reset on
// each introDone" regression produces a clearly out-of-band timing
// reading (correct: ~5s, reset-bug: ~8s); short enough that the spec
// runtime stays bounded. 5s also leaves room for the second walk
// (~3-5s) to land inside the window before the timer expires.
const DISPATCH_WAIT_S = 5;

// Delay between starting playerA's walk and playerB's. Picked to be
// large enough that a "reset timer on each introDone" regression's
// dispatchDelay (~stagger + dispatchWait) clears the upper bound
// below, but small enough that playerB's introDone still lands
// inside playerA's dispatchWait window (otherwise the first dispatch
// fires alone, fails to match, and a second cycle adds ~dispatchWait
// to the observed delay — a different bug case the lower bound
// already catches).
const STAGGER_MS = 3000;

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "multi-dispatch-timing",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

test(`dispatchWait: dispatcher fires ~${DISPATCH_WAIT_S}s after first arrival, debounced (single timer cycle covers both players)`, async ({
  browser,
}) => {
  const batchName = `multi_dispatch_timing_${Date.now()}`;
  const playerAKey = `dispatch_timing_a_${Date.now()}`;
  const playerBKey = `dispatch_timing_b_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({
      batchName,
      treatments: ["multi_2p_shared"],
      dispatchWait: DISPATCH_WAIT_S,
    }),
  );

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

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

    // Kick off playerA's walk WITHOUT awaiting — they'll proceed
    // through intro and arm the dispatch timer when they reach
    // introDone server-side. walkToGame's final waitFor blocks until
    // the game prompt renders, which happens only after dispatch +
    // game.start() complete.
    const walkA = walkToGame(pageA, {
      url: stack.urls.player,
      playerKey: playerAKey,
      gamePromptName: "sharedColor",
    });

    // Sleep STAGGER_MS, then start playerB. By the time their
    // introDone fires, playerA's dispatch timer is already running
    // (correct path: piggyback). A regression where every introDone
    // restarts the timer would push the dispatch delay measured below
    // by ~STAGGER_MS, which the upper bound is calibrated to reject.
    await new Promise((resolve_) => {
      setTimeout(resolve_, STAGGER_MS);
    });
    const walkB = walkToGame(pageB, {
      url: stack.urls.player,
      playerKey: playerBKey,
      gamePromptName: "sharedColor",
    });

    await Promise.all([walkA, walkB]);

    // Per-worker stack means tajriba is fresh: this batch is the only
    // batch, so there is exactly one game scope and exactly two player
    // scopes. We can pull them by kind without filtering by batchId.
    // listScopes' edge ordering is whatever Tajriba returns — we use
    // playerScopes[0]/[1] as opaque handles and rely on Math.min over
    // both timestamps for the timing math, so the order doesn't
    // matter for correctness.
    const playerScopes = await listScopes(admin, { kind: "player" });
    expect(playerScopes.length, "expected exactly 2 player scopes").toBe(2);
    const gameScopes = await listScopes(admin, { kind: "game" });
    expect(gameScopes.length, "expected exactly 1 game scope").toBe(1);

    const player0Attrs = (await getAttributes(admin, playerScopes[0].id)).attrs;
    const player1Attrs = (await getAttributes(admin, playerScopes[1].id)).attrs;
    const gameAttrs = (await getAttributes(admin, gameScopes[0].id)).attrs;

    expect(
      player0Attrs.timeIntroDone,
      "first player scope must have timeIntroDone set",
    ).toBeTruthy();
    expect(
      player1Attrs.timeIntroDone,
      "second player scope must have timeIntroDone set",
    ).toBeTruthy();
    expect(
      gameAttrs.timeGameStarted,
      "game must have timeGameStarted set",
    ).toBeTruthy();

    // ── Same-game pin ─────────────────────────────────────────────
    // Both players must be in this single game. If a regression
    // somehow split them across two games (e.g. timer reset between
    // them), the game-count check above would already fail; this
    // pins the per-row gameId↔scope linkage too.
    expect(player0Attrs.gameId).toBe(gameScopes[0].id);
    expect(player1Attrs.gameId).toBe(gameScopes[0].id);

    // ── Timing pin ────────────────────────────────────────────────
    // dispatchDelayMs = timeGameStarted - earliest(timeIntroDone).
    // The dispatcher's debounced timer is armed by the first
    // introDone callback and fires `dispatchWait` seconds later,
    // regardless of how many subsequent players become ready inside
    // the window. The game-start callback writes timeGameStarted
    // shortly after dispatch + game.start() (sub-second on a
    // non-video fixture), so the observed delay is dispatchWait
    // plus a small overhead.
    const earliestIntroDoneMs = Math.min(
      Date.parse(player0Attrs.timeIntroDone),
      Date.parse(player1Attrs.timeIntroDone),
    );
    const timeGameStartedMs = Date.parse(gameAttrs.timeGameStarted);
    const dispatchDelayMs = timeGameStartedMs - earliestIntroDoneMs;

    // Lower bound: dispatcher must NOT fire immediately on quorum —
    // it has to wait at least most of dispatchWait. 0.9 is safe
    // because timeIntroDone is server-stamped at the top of the
    // introDone callback BEFORE debounceRunDispatch is invoked
    // (callbacks.js), so there's no positive skew to absorb.
    expect(
      dispatchDelayMs,
      `dispatch fired too early (${dispatchDelayMs}ms after first introDone) — dispatchWait timer was not respected`,
    ).toBeGreaterThanOrEqual(DISPATCH_WAIT_S * 1000 * 0.9);

    // Upper bound: dispatchWait + 3000ms overhead. Three components
    // make up the overhead budget: setTimeout drift, the Empirica
    // reactor processing the new game scope, and the game-start
    // callback chain writing timeGameStarted. With STAGGER_MS=3000,
    // a "timer reset on each introDone" regression measures
    // ~stagger + dispatchWait + overhead = ~8s+, which exceeds this
    // bound (8s) by enough margin to fail decisively without making
    // the correct path (~5s) flaky on a slow CI runner.
    expect(
      dispatchDelayMs,
      `dispatch fired too late (${dispatchDelayMs}ms after first introDone) — timer was not debounced (likely reset on each subsequent introDone)`,
    ).toBeLessThanOrEqual(DISPATCH_WAIT_S * 1000 + 3000);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
    await ctxA.close();
    await ctxB.close();
  }
});
