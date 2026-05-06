// Not-matched timeout L3 spec. Pins the platform contract that:
//
//   When fewer than `playerCount` participants arrive and the
//   `dispatchWait` timer expires, the lone player remains in the
//   lobby — no game is created, no premature placement into a
//   partially-filled game, no error path triggered.
//
// Approach: spin up a 2-player treatment with `dispatchWait: 1`,
// walk ONE participant through intro to the lobby, then wait long
// enough for the dispatcher to fire and complete (dispatchWait + a
// few seconds buffer). Read state via the admin GraphQL API.
//
// What this catches that lower layers don't:
//   - L1 dispatcher tests verify the algorithm: given an available-
//     players list with fewer slots than any complete treatment, no
//     assignment is produced. They don't observe the orchestration
//     layer (callbacks.js + the lobby-rendering router) — a
//     regression where the server creates a partial game scope, or
//     advances the lone player out of the lobby anyway, would slip
//     past every L1 test.
//   - L2 `playwright/component-tests/intro-exit/Lobby.ct.jsx` pins
//     what the lobby renders given a player in the "introDone but
//     not assigned" state (including the 10-minute timeout flip to
//     the partial-payment exit-code view) — but that test uses a
//     synthetic player and never exercises the dispatch loop.
//   - The api-driven hybrid spec exercises a similar flow as a
//     discovery test (mapping the attribute surface) but doesn't
//     pin the no-game / lobby-UI invariants as the contract under
//     test, so a regression that silently flipped them wouldn't be
//     caught there either.

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
import { walkToLobby } from "../_helpers/walkParticipant.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

// Short dispatchWait keeps the spec fast — we only need the
// dispatcher to actually fire (and fail to find a quorum) once.
const DISPATCH_WAIT_S = 1;

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "multi-not-matched",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

test("not matched: 1 player + 2-player treatment + dispatchWait elapses → player stays in lobby, no game created", async ({
  browser,
}) => {
  const batchName = `multi_not_matched_${Date.now()}`;
  const p1Key = `not_matched_p1_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({
      batchName,
      treatments: ["multi_2p_shared"],
      dispatchWait: DISPATCH_WAIT_S,
    }),
  );

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

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

    // Walk ONE player to the lobby. The 2-player treatment can't be
    // satisfied with only one available player, so when the dispatch
    // timer fires below, no assignment is produced.
    await walkToLobby(page, { url: stack.urls.player, playerKey: p1Key });

    // Block until introDone is observed server-side — that's the
    // event that arms the dispatchWait timer. Without this wait, the
    // subsequent sleep could race ahead of the timer being set.
    const players = await listScopes(admin, { kind: "player" });
    expect(players.length, "expected exactly 1 player scope").toBe(1);
    const playerId = players[0].id;
    await waitForAttribute(
      admin,
      playerId,
      (attrs) => attrs.introDone === true,
      { timeoutMs: 15_000 },
    );

    // Sleep long enough for the dispatcher to fire AND finish. Once
    // the timer expires, runDispatch synchronously evaluates the
    // available-players set; with only 1 player and a 2-player
    // treatment, no assignments are produced and the timer is
    // cleared. dispatchWait + 2s buffer covers a slow CI runner.
    await page.waitForTimeout(DISPATCH_WAIT_S * 1000 + 2000);

    // ── Player-state pin ──────────────────────────────────────────
    // The player is fully through intro (introDone=true) but has not
    // been placed in any game (gameId is unset). A regression that
    // creates a partial 2-player game with 1 slot empty would set
    // gameId here and fail this assertion.
    const after = await getAttributes(admin, playerId);
    expect(
      after.attrs.introDone,
      "player must have completed intro before the dispatch timer fired",
    ).toBe(true);
    expect(
      after.attrs.gameId,
      `player must NOT be assigned to a game — got gameId=${JSON.stringify(after.attrs.gameId)}`,
    ).toBeFalsy();
    expect(
      after.attrs.assigned,
      "player must NOT be marked assigned",
    ).toBeFalsy();
    expect(
      after.attrs.position,
      `player must NOT have a position — got position=${JSON.stringify(after.attrs.position)}`,
    ).toBeFalsy();

    // ── No-game pin ───────────────────────────────────────────────
    // Per-worker stack with one batch in this spec means: any game
    // scope present here was created from this batch's dispatch.
    // None should exist. A regression that creates a 2-player game
    // with 1 player (or worse, a 1-player game from a 2-player
    // treatment) would surface here.
    const games = await listScopes(admin, { kind: "game" });
    expect(
      games.length,
      `expected NO game scopes — dispatcher should not place a single player into a 2-player treatment; got ${games.length}`,
    ).toBe(0);

    // ── Lobby-UI pin ──────────────────────────────────────────────
    // Player-side: the lobby renders the initial "Matching you with
    // a group..." message. The 10-minute lobby-timeout flip to the
    // partial-payment exit-code view is pinned at L2 in
    // playwright/component-tests/intro-exit/Lobby.ct.jsx; here we
    // only need to confirm the player landed on the lobby surface
    // at all (rather than e.g. being routed to a stage or an error
    // page when dispatch failed to match).
    await expect(
      page.getByText(/matching you with a group/i),
      "lobby's initial 'Matching you with a group...' message should be visible — player was not routed elsewhere",
    ).toBeVisible();
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
    await ctx.close();
  }
});
