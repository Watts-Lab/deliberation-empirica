// Batch termination with N in-flight players L3 spec.
//
// Pins what happens when admin terminates a batch while multiple
// players are mid-game. Two things must happen, both gated on the
// `Empirica.on("batch", "status")` handler in callbacks.js:217-228:
//
//   (1) closeBatch fires once per in-flight player. Each player gets
//       exitStatus="incomplete", a row in *.scienceData.jsonl, and a
//       row in *.payment.jsonl. Their UI transitions away from the
//       game stage (no stuck loading) — the React client unmounts
//       EmpiricaContext when recruitingBatchConfig clears, so the
//       page falls through to NoGames.
//
//   (2) setCurrentlyRecruitingBatch's empty-case fires. With no other
//       open batches, callbacks.js:235-240 clears
//       globals.recruitingBatchConfig and recruitingBatchIntroSequence.
//       A fresh participant connecting after termination must see
//       NoGames "no studies available" — the same branch failedBatchUX
//       pins for the failed-batch path, but reached here via a
//       successfully-running batch that was admin-terminated rather
//       than failing at preflight.
//
// What this catches that lower layers don't:
//   - L1 server-vitest covers `selectOldestBatch`/`getOpenBatches`
//     against synthetic batch lists (#100 sister coverage). Those
//     can't observe the closeBatch fan-out across actual in-flight
//     player scopes, nor the React client's reaction to the global
//     scope flip.
//   - The solo cancel test (solo/test.spec.mjs) terminates a batch
//     with one *registered-but-not-yet-in-game* participant. It pins
//     a single row + the post-reload "experiment is now closed"
//     message, but says nothing about the multi-player fan-out OR
//     the in-flight (mid-game-stage) case.
//   - parallelBatchesRecruiting (#100) pins the *non-empty* path of
//     setCurrentlyRecruitingBatch (next-oldest takes over). The
//     empty-case (last open batch terminates → recruitingBatchConfig
//     cleared) is pinned indirectly only by failedBatchUX, which
//     hits it via the failed-status path; this spec hits it via the
//     terminated-status path with players actually mid-game.
//   - failedBatchUX (#92) verifies the empty-case for a batch that
//     never had participants. This spec verifies it for a batch that
//     successfully ran with N in-flight players — a different code
//     path through the same handler, since closeBatch + the global
//     clear share the handler but closeBatch is a no-op for the
//     never-ran case.
//
// Why the 2-player count: the issue (#120) frames this as an
// N-player fan-out test. 2 is the minimum N>1 — enough to catch a
// regression that fired closeBatch only for the first player (e.g.
// missing await on Promise.all, early-return in the loop). The
// multi_2p_shared treatment is reused from this folder's other
// specs and gives both players a prompt to land on so the "stuck
// loading" assertion has something concrete to test against.

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { readdirSync, readFileSync } from "fs";

import { launchStack } from "../_helpers/empiricaServer.mjs";
import {
  connectAsAdmin,
  readSrtoken,
  createBatch,
  startBatch,
  stopBatch,
  waitForAttribute,
} from "../_helpers/empiricaAdminAPI.mjs";
import { batchConfig } from "../_helpers/batchConfig.mjs";
import { walkToGame } from "../_helpers/walkParticipant.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "multi-terminate",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

function readBatchRows(batchName, suffix) {
  const files = readdirSync(stack.dataDir);
  const file = files.find((f) => f.endsWith(suffix) && f.includes(batchName));
  if (!file) {
    throw new Error(
      `expected a ${suffix} for batch ${batchName} in ${stack.dataDir}, got: ${files.join(", ")}`,
    );
  }
  const body = readFileSync(join(stack.dataDir, file), "utf8").trim();
  return body
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("terminating a batch with 2 in-flight players: closeBatch fan-out + recruitingBatchConfig empty-case", async ({
  browser,
}) => {
  const batchName = `multi_terminate_inflight_${Date.now()}`;
  const p1Key = `multi_terminate_p1_${Date.now()}`;
  const p2Key = `multi_terminate_p2_${Date.now()}`;
  // Used by the post-termination empty-case probe — a fresh
  // participant connects with no open batches and must see the
  // NoGames "no studies available" branch.
  const probeKey = `multi_terminate_probe_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({ batchName, treatments: ["multi_2p_shared"] }),
  );

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const ctxProbe = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

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

    // Both players need to be IN-FLIGHT — past intro, in the game
    // stage with a prompt rendered. walkToGame waits on the named
    // prompt selector, so both pages are demonstrably mid-game when
    // it returns. The dispatcher needs both in the lobby
    // simultaneously to match them, so walk in parallel.
    await Promise.all([
      walkToGame(p1, {
        url: stack.urls.player,
        playerKey: p1Key,
        gamePromptName: "sharedColor",
      }),
      walkToGame(p2, {
        url: stack.urls.player,
        playerKey: p2Key,
        gamePromptName: "sharedColor",
      }),
    ]);

    // Confirm both are on the prompt. The visibility check is the
    // pre-condition for the "no longer stuck" assertion below — if
    // we never saw the prompt, "prompt gone" wouldn't tell us
    // anything.
    const sharedSelector = '[data-testid="element-prompt-sharedColor"]';
    await expect(p1.locator(sharedSelector)).toBeVisible();
    await expect(p2.locator(sharedSelector)).toBeVisible();

    // ── Terminate the batch while both players are mid-game ────────
    // batch.status flips → callbacks.js:217-228 fires → closeBatch
    // fans out across both player scopes, exportScienceData +
    // exportPaymentData run, setCurrentlyRecruitingBatch sees no
    // open batches and clears the global config.
    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
    // closeOutPlayer + the JSONL writes happen async after the status
    // flip. Same settle window as parallelBatchesRecruiting / smoke.
    await p1.waitForTimeout(2000);

    // ── (1) Player UI: no longer stuck on the game prompt ──────────
    // The contract is "the player doesn't sit on a loading state
    // forever". Once setCurrentlyRecruitingBatch clears
    // recruitingBatchConfig, App.jsx's `if (!batchConfig)` branch
    // returns <NoGames /> — EmpiricaContext unmounts and the prompt
    // disappears. Asserting the prompt is GONE on both players is
    // the load-bearing assertion; the specific NoGames sub-message
    // ("no studies available" vs "experiment is now closed") depends
    // on whether usePlayer still resolves after EmpiricaContext
    // unmounts, which is an Empirica internals detail and not what
    // we're pinning here.
    await expect(p1.locator(sharedSelector)).toBeHidden({ timeout: 30_000 });
    await expect(p2.locator(sharedSelector)).toBeHidden({ timeout: 30_000 });

    // Pin that some NoGames-branch message rendered (any of the
    // three is fine — see comment above). A regression that left
    // the player on a blank screen / spinner would fail this.
    const noGamesText =
      /(There are no studies available at this time\.|The experiment is now closed\.|Thank you for participating!)/;
    await expect(p1.getByText(noGamesText).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(p2.getByText(noGamesText).first()).toBeVisible({
      timeout: 10_000,
    });

    // ── (2) scienceData JSONL: one row per in-flight player ────────
    // closeBatch's Promise.all over batchPlayers must produce a
    // scienceData row for each. A regression that bailed after the
    // first player (e.g. missing await, early return on a falsy
    // game lookup, throw-on-missing-game-id) would leave us with
    // < 2 rows.
    const scienceRows = readBatchRows(batchName, ".scienceData.jsonl");
    expect(
      scienceRows.length,
      "expected one scienceData row per in-flight player",
    ).toBe(2);
    for (const row of scienceRows) {
      expect(row.exitStatus).toBe("incomplete");
      expect(row.batchId).toBe(batchId);
    }

    // ── (3) payment.jsonl: one row per in-flight player ────────────
    // Same fan-out contract for the payment writer. payment.jsonl
    // carries platformId (== playerKey for our fixtures), so we can
    // assert each player's row by identity.
    const paymentRows = readBatchRows(batchName, ".payment.jsonl");
    expect(
      paymentRows.length,
      "expected one payment row per in-flight player",
    ).toBe(2);
    const paymentPlatformIds = paymentRows.map((r) => r.platformId).sort();
    expect(paymentPlatformIds).toEqual([p1Key, p2Key].sort());
    for (const row of paymentRows) {
      expect(row.exitStatus).toBe("incomplete");
    }

    // ── (4) recruitingBatchConfig empty-case ───────────────────────
    // With no other open batches, callbacks.js:235-240 should have
    // cleared globals.recruitingBatchConfig. A FRESH participant
    // connecting now must hit App.jsx's `if (!batchConfig)` branch
    // → <NoGames /> with no player record → "no studies available"
    // (the third branch in NoGames.jsx, gated on `else` of
    // `playerComplete` and `else if (player)`).
    //
    // This is the precedent failedBatchUX uses for the failed-batch
    // empty-case; here we're pinning the same end-state reached via
    // a successfully-running-then-terminated batch (different code
    // path through the same status handler).
    const probe = await ctxProbe.newPage();
    await probe.goto(`${stack.urls.player}?playerKey=${probeKey}`, {
      waitUntil: "load",
    });
    await expect(
      probe.getByText("There are no studies available at this time."),
    ).toBeVisible({ timeout: 30_000 });
    // Pin the negative: IdForm must NOT render. A regression that
    // failed to clear recruitingBatchConfig would leave App.jsx in
    // the EmpiricaContext branch, which mounts IdForm via
    // playerCreate.
    await expect(
      probe.locator('input[data-testid="inputPaymentId"]'),
      "IdForm must NOT render — recruitingBatchConfig should have cleared on termination",
    ).toHaveCount(0);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
    await ctx1.close();
    await ctx2.close();
    await ctxProbe.close();
  }
});
