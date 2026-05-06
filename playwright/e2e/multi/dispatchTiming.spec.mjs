// Dispatch-timing L3 spec. Pins the platform contract that:
//
//   1. The first introDone arrival starts a `dispatchWait` timer.
//   2. The dispatcher fires once that timer expires (NOT immediately
//      on quorum), and a single timer cycle covers both players —
//      i.e. the timer is debounced from the first arrival, not
//      restarted by every subsequent introDone.
//
// Approach: spin up a 2-player treatment with a long `dispatchWait`
// (10s, vs the 1s default), kick off playerA's walk, wait for A's
// introDone server-side via the admin API, sleep STAGGER_MS, then
// kick off playerB. Read three server-stamped timestamps:
//   - aAttrs.timeIntroDone, bAttrs.timeIntroDone (server clock at
//     each introDone callback)
//   - game.timeGameStarted (server clock at game-start callback)
//
// Why stagger relative to A's *server-side introDone* (not relative
// to when walkA was started): the load-bearing upper-bound assertion
// needs to discriminate the correct path
// (`dispatchDelay ≈ dispatchWait`) from the timer-reset regression
// (`dispatchDelay ≈ stagger + dispatchWait`). Wall-clock stagger
// between walks has too much variance — if walkA's intro takes
// longer than expected, the actual server-side gap can shrink to
// near zero and the upper-bound assertion goes toothless. Anchoring
// to A's introDone makes the gap deterministic; a precondition
// assertion below (B - A ≥ STAGGER_MS) fails loudly with a clear
// message if setup races and the gap shrinks anyway.
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

// Long enough that B's introDone (which lands at A.introDone +
// STAGGER_MS + walkB intro time, ≈ 6-9s on a slow runner) still
// arrives well before the dispatchWait timer fires. If B's introDone
// landed AFTER the timer, the first dispatch would fire alone with
// only A available, fail to match, and a second cycle would add
// another dispatchWait — producing the same delay shape as the
// timer-reset regression and confusing the assertion.
const DISPATCH_WAIT_S = 10;

// Server-side delay between A's introDone and the start of B's walk.
// Picked to be large enough that a "reset timer on each introDone"
// regression's `stagger + dispatchWait + overhead` delay clears the
// upper bound below by a comfortable margin (regression ≈ 16s+ vs
// upper bound 13s), without risking a precondition violation on a
// slow runner.
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
    // game.start() complete; we'll await both walks below once B has
    // started.
    const walkA = walkToGame(pageA, {
      url: stack.urls.player,
      playerKey: playerAKey,
      gamePromptName: "sharedColor",
    });

    // Wait for A's player scope to appear in tajriba. Polling for ANY
    // player scope is safe here because walkB hasn't started yet, so
    // the first scope to appear is A's.
    const playerScopeAppearDeadline = Date.now() + 30_000;
    let aPlayerId;
    while (Date.now() < playerScopeAppearDeadline) {
      // eslint-disable-next-line no-await-in-loop
      const scopes = await listScopes(admin, { kind: "player" });
      if (scopes.length >= 1) {
        aPlayerId = scopes[0].id;
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => {
        setTimeout(r, 200);
      });
    }
    expect(
      aPlayerId,
      "playerA's scope did not appear in admin API within 30s",
    ).toBeTruthy();

    // Block until A's introDone is observed server-side. This is the
    // moment debounceRunDispatch arms the dispatch timer — i.e. the
    // anchor point we want to stagger relative to.
    await waitForAttribute(
      admin,
      aPlayerId,
      (attrs) => attrs.introDone === true && !!attrs.timeIntroDone,
      { timeoutMs: 30_000 },
    );

    // Now sleep STAGGER_MS and start walkB. The server-side gap
    // between A's and B's timeIntroDone will be at least STAGGER_MS
    // (plus walkB's intro time + admin polling latency), guaranteed
    // — the precondition assertion below makes the contract explicit
    // so a setup race produces a clear failure rather than a
    // silently-degraded timing pin.
    await new Promise((r) => {
      setTimeout(r, STAGGER_MS);
    });
    const walkB = walkToGame(pageB, {
      url: stack.urls.player,
      playerKey: playerBKey,
      gamePromptName: "sharedColor",
    });

    await Promise.all([walkA, walkB]);

    // Per-worker stack means tajriba is fresh: this batch is the only
    // batch, so there is exactly one game scope and exactly two
    // player scopes (one of which is aPlayerId from above; the other
    // is B's).
    const playerScopes = await listScopes(admin, { kind: "player" });
    expect(playerScopes.length, "expected exactly 2 player scopes").toBe(2);
    const gameScopes = await listScopes(admin, { kind: "game" });
    expect(gameScopes.length, "expected exactly 1 game scope").toBe(1);

    const bScope = playerScopes.find((s) => s.id !== aPlayerId);
    expect(bScope, "could not identify B's scope").toBeTruthy();

    const aAttrs = (await getAttributes(admin, aPlayerId)).attrs;
    const bAttrs = (await getAttributes(admin, bScope.id)).attrs;
    const gameAttrs = (await getAttributes(admin, gameScopes[0].id)).attrs;

    expect(
      aAttrs.timeIntroDone,
      "playerA must have timeIntroDone set",
    ).toBeTruthy();
    expect(
      bAttrs.timeIntroDone,
      "playerB must have timeIntroDone set",
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
    expect(aAttrs.gameId).toBe(gameScopes[0].id);
    expect(bAttrs.gameId).toBe(gameScopes[0].id);

    // ── Stagger precondition ──────────────────────────────────────
    // The timing pin's discriminating power between the correct path
    // and the timer-reset regression depends on B's introDone landing
    // at least STAGGER_MS after A's. We engineered the test to enforce
    // this by anchoring on A's server-side introDone before sleeping;
    // assert the invariant holds so a setup race produces a clear,
    // actionable failure (rather than silently weakening the upper
    // bound below).
    const aTimeIntroDoneMs = Date.parse(aAttrs.timeIntroDone);
    const bTimeIntroDoneMs = Date.parse(bAttrs.timeIntroDone);
    const actualStaggerMs = bTimeIntroDoneMs - aTimeIntroDoneMs;
    expect(
      actualStaggerMs,
      `B's introDone must land at least ${STAGGER_MS}ms after A's (precondition for the upper-bound assertion below); got ${actualStaggerMs}ms — likely a setup race`,
    ).toBeGreaterThanOrEqual(STAGGER_MS);

    // ── Timing pin ────────────────────────────────────────────────
    // dispatchDelayMs = timeGameStarted - aTimeIntroDone.
    // The debounced timer is armed by A's introDone (the first one),
    // fires `dispatchWait` seconds later, runs the dispatcher, and
    // the game-start callback writes timeGameStarted shortly after
    // (sub-second on a non-video fixture). So the observed delay is
    // dispatchWait plus a small overhead.
    const timeGameStartedMs = Date.parse(gameAttrs.timeGameStarted);
    const dispatchDelayMs = timeGameStartedMs - aTimeIntroDoneMs;

    // Lower bound: dispatcher must NOT fire immediately on quorum —
    // it has to wait at least most of dispatchWait. 0.9 is safe
    // because timeIntroDone is server-stamped at the top of the
    // introDone callback BEFORE debounceRunDispatch is invoked
    // (callbacks.js), so there's no positive skew to absorb.
    expect(
      dispatchDelayMs,
      `dispatch fired too early (${dispatchDelayMs}ms after A's introDone) — dispatchWait timer was not respected`,
    ).toBeGreaterThanOrEqual(DISPATCH_WAIT_S * 1000 * 0.9);

    // Upper bound: dispatchWait + 3000ms overhead. Three components
    // make up the overhead budget: setTimeout drift, the Empirica
    // reactor processing the new game scope, and the game-start
    // callback chain writing timeGameStarted. With STAGGER_MS=3000,
    // a "timer reset on each introDone" regression measures
    // ≥ stagger + dispatchWait + overhead ≈ 16s, comfortably above
    // this bound (13s) — failure is decisive without making the
    // correct path (~10.5s) flaky on a slow CI runner.
    expect(
      dispatchDelayMs,
      `dispatch fired too late (${dispatchDelayMs}ms after A's introDone) — timer was not debounced (likely reset on each subsequent introDone)`,
    ).toBeLessThanOrEqual(DISPATCH_WAIT_S * 1000 + 3000);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
    await ctxA.close();
    await ctxB.close();
  }
});
